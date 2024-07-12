import { asyncMethodCallContextStore, traceInstanceMethods } from '@rocket.chat/core-services';
import type { RocketChatRecordDeleted } from '@rocket.chat/core-typings';
import type { IBaseModel, DefaultFields, ResultFields, FindPaginated, InsertionModel } from '@rocket.chat/model-typings';
import { getCollectionName } from '@rocket.chat/models';
import { MongoInternals } from 'meteor/mongo';
import { ObjectId } from 'mongodb';
import type {
	BulkWriteOptions,
	ChangeStream,
	Collection,
	CollectionOptions,
	Db,
	Filter,
	FindOneAndUpdateOptions,
	IndexDescription,
	InsertOneOptions,
	ModifyResult,
	OptionalUnlessRequiredId,
	UpdateFilter,
	WithId,
	UpdateOptions,
	Document,
	FindOptions,
	FindCursor,
	UpdateResult,
	InsertManyResult,
	InsertOneResult,
	DeleteResult,
	DeleteOptions,
} from 'mongodb';

import { setUpdatedAt } from './setUpdatedAt';

const warnFields =
	process.env.NODE_ENV !== 'production' || process.env.SHOW_WARNINGS === 'true'
		? (...rest: any): void => {
				console.warn(...rest, new Error().stack);
		  }
		: new Function();

type ModelOptions = {
	preventSetUpdatedAt?: boolean;
	collectionNameResolver?: (name: string) => string;
	collection?: CollectionOptions;
	_updatedAtIndexOptions?: Omit<IndexDescription, 'key'>;
};

function getCallerNames(skip = 1, limit = 4) {
	// const a = Date.now();
	let data = [];
	try {
		try {
			throw new Error();
		} catch (e) {
			// console.log(e.stack);
			data = e.stack.match(/(?<=at )[^\(\n]+(?= \()/g).splice(skip, limit);
		}
	} catch (e) {
		// return [];
	}
	// console.log(Date.now() - a);
	return data;
}

const { client } = MongoInternals.defaultRemoteCollectionDriver().mongo;
// console.log(client);
const DurationStart = new Map();
client.on('commandStarted', (event) => {
	// const collection = event.command[event.commandName];
	// if (collection !== 'rocketchat_settings') return;

	// console.log(JSON.stringify(event, null, 2));
	// console.log('asyncMethodCallContextStore.getStore()', asyncMethodCallContextStore.getStore());
	if (asyncMethodCallContextStore.getStore()) {
		DurationStart.set(event.requestId, { event, store: asyncMethodCallContextStore.getStore() });
		// console.log(JSON.stringify(event, 2));
	}
});
client.on('commandSucceeded', (event) => {
	if (!DurationStart.has(event.requestId)) {
		return;
	}

	const { event: startEvent, store } = DurationStart.get(event.requestId);
	DurationStart.delete(event.requestId);

	const number =
		event.reply.n ?? event.reply.cursor?.firstBatch?.length ?? event.reply.cursor?.nextBatch?.length ?? event.reply.lastErrorObject?.n ?? 0;
	const { duration } = event;
	const cmd =
		startEvent.command.filter ||
		startEvent.command.query ||
		startEvent.command.deletes ||
		startEvent.command.updates ||
		startEvent.command.pipeline ||
		startEvent.command.indexes;
	const result = {
		type: 'db:command',
		collection: startEvent.command[startEvent.commandName],
		command: event.commandName,
		caller: cmd?.$comment || JSON.stringify(cmd),
		duration,
		number,
	};
	store.push(result);
	// console.log('asyncMethodCallContextStore.getStore()', asyncMethodCallContextStore.getStore());
	// console.log('commandSucceeded', { duration, number });
	// console.log(result);
	// metrics.collectionsByTime.set(result, duration);
	// metrics.collectionsByRecord.set(result, number);

	// if (event.commandName === 'findAndModify') {
	// 	console.log(startEvent);
	// 	console.log(event);
	// }
	// if (!['find', 'update', 'getMore', 'ismaster', 'listIndexes', 'count', 'delete', 'serverStatus', 'insert', 'createIndexes', 'aggregate', 'drop', 'findAndModify'].includes(result.command)) {
	// 	console.log({
	// 		...result,
	// 		duration,
	// 		number,
	// 		durationPerNumber: number === 0 ? 0 : duration / number,
	// 	});
	// 	console.log(startEvent);
	// 	console.log(event);
	// }
});
client.on('commandFailed', (event) => DurationStart.delete(event.requestId));

// const monitorMongoCommands = process.env.MONITOR_MONGO_COMMANDS === 'true';
const monitorMongoCommands = true;

export abstract class BaseRaw<
	T extends { _id: string },
	C extends DefaultFields<T> = undefined,
	TDeleted extends RocketChatRecordDeleted<T> = RocketChatRecordDeleted<T>,
> implements IBaseModel<T, C, TDeleted>
{
	public readonly defaultFields: C;

	public readonly col: Collection<T>;

	private preventSetUpdatedAt: boolean;

	/**
	 * Collection name to store data.
	 */
	private collectionName: string;

	/**
	 * @param db MongoDB instance
	 * @param name Name of the model without any prefix. Used by trash records to set the `__collection__` field.
	 * @param trash Trash collection instance
	 * @param options Model options
	 */
	constructor(private db: Db, protected name: string, protected trash?: Collection<TDeleted>, private options?: ModelOptions) {
		this.collectionName = options?.collectionNameResolver ? options.collectionNameResolver(name) : getCollectionName(name);

		this.col = this.db.collection(this.collectionName, options?.collection || {});

		void this.createIndexes().catch((e) => {
			console.warn(`Some indexes for collection '${this.collectionName}' could not be created:\n\t${e.message}`);
		});

		this.preventSetUpdatedAt = options?.preventSetUpdatedAt ?? false;

		return traceInstanceMethods(this);
	}

	private pendingIndexes: Promise<void> | undefined;

	public async createIndexes() {
		const indexes = this.modelIndexes();
		if (this.options?._updatedAtIndexOptions) {
			indexes?.push({ ...this.options._updatedAtIndexOptions, key: { _updatedAt: 1 } });
		}

		if (indexes?.length) {
			if (this.pendingIndexes) {
				await this.pendingIndexes;
			}

			this.pendingIndexes = this.col.createIndexes(indexes) as unknown as Promise<void>;

			void this.pendingIndexes.finally(() => {
				this.pendingIndexes = undefined;
			});

			return this.pendingIndexes;
		}
	}

	protected modelIndexes(): IndexDescription[] | undefined {
		return undefined;
	}

	getCollectionName(): string {
		return this.collectionName;
	}

	private doNotMixInclusionAndExclusionFields(options: FindOptions<T> = {}): FindOptions<T> {
		const optionsDef = this.ensureDefaultFields(options);
		if (optionsDef?.projection === undefined) {
			return optionsDef;
		}

		const projection: Record<string, any> = optionsDef?.projection;
		const keys = Object.keys(projection);
		const removeKeys = keys.filter((key) => projection[key] === 0);
		if (keys.length > removeKeys.length) {
			removeKeys.forEach((key) => delete projection[key]);
		}

		return {
			...optionsDef,
			projection,
		};
	}

	private ensureDefaultFields<P extends Document>(options: FindOptions<P>): FindOptions<P>;

	private ensureDefaultFields<P extends Document>(
		options?: FindOptions<P> & { fields?: FindOptions<P>['projection'] },
	): FindOptions<P> | FindOptions<T> | undefined {
		if (options?.fields) {
			warnFields("Using 'fields' in models is deprecated.", options);
		}

		if (this.defaultFields === undefined) {
			return options;
		}

		const { fields: deprecatedFields, projection, ...rest } = options || {};

		const fields = { ...deprecatedFields, ...projection };

		return {
			projection: this.defaultFields,
			...(fields && Object.values(fields).length && { projection: fields }),
			...rest,
		};
	}

	public findOneAndUpdate(query: Filter<T>, update: UpdateFilter<T> | T, options?: FindOneAndUpdateOptions): Promise<ModifyResult<T>> {
		this.setUpdatedAt(update);
		return this.col.findOneAndUpdate(query, update, options || {});
	}

	async findOneById(_id: T['_id'], options?: FindOptions<T>): Promise<T | null>;

	async findOneById<P extends Document = T>(_id: T['_id'], options?: FindOptions<P>): Promise<P | null>;

	async findOneById(_id: T['_id'], options?: any): Promise<T | null> {
		const query: Filter<T> = { _id } as Filter<T>;
		if (options) {
			return this.findOne(query, options);
		}
		return this.findOne(query);
	}

	async findOne(query?: Filter<T> | T['_id'], options?: undefined): Promise<T | null>;

	async findOne<P extends Document = T>(query: Filter<T> | T['_id'], options?: FindOptions<P extends T ? T : P>): Promise<P | null>;

	async findOne<P>(query: Filter<T> | T['_id'] = {}, options?: any): Promise<WithId<T> | WithId<P> | null> {
		const q: Filter<T> = typeof query === 'string' ? ({ _id: query } as Filter<T>) : query;

		// if (monitorMongoCommands) {
		// 	console.log(1, q);
		// 	if (typeof q === 'string') {
		// 		q = { _id: q };
		// 	}
		// 	q.$comment = getCallerNames().reverse().join(' > ');
		// }

		const optionsDef = this.doNotMixInclusionAndExclusionFields(options);
		if (optionsDef) {
			return this.col.findOne(q, optionsDef);
		}
		return this.col.findOne(q);
	}

	find(query?: Filter<T>): FindCursor<ResultFields<T, C>>;

	find<P extends Document = T>(query: Filter<T>, options?: FindOptions<P extends T ? T : P>): FindCursor<P>;

	find<P extends Document>(
		query: Filter<T> = {},
		options?: FindOptions<P extends T ? T : P>,
	): FindCursor<WithId<P>> | FindCursor<WithId<T>> {
		// if (monitorMongoCommands) {
		// 	console.log(2, query);
		// 	if (typeof query === 'string') {
		// 		query = { _id: query };
		// 	}
		// 	query.$comment = getCallerNames().reverse().join(' > ');
		// }

		const optionsDef = this.doNotMixInclusionAndExclusionFields(options);
		return this.col.find(query, optionsDef);
	}

	findPaginated<P extends Document = T>(query: Filter<T>, options?: FindOptions<P extends T ? T : P>): FindPaginated<FindCursor<WithId<P>>>;

	findPaginated(query: Filter<T> = {}, options?: any): FindPaginated<FindCursor<WithId<T>>> {
		// if (monitorMongoCommands) {
		// 	console.log(3, query);
		// 	if (typeof query === 'string') {
		// 		query = { _id: query };
		// 	}
		// 	query.$comment = getCallerNames().reverse().join(' > ');
		// }

		const optionsDef = this.doNotMixInclusionAndExclusionFields(options);

		const cursor = optionsDef ? this.col.find(query, optionsDef) : this.col.find(query);
		const totalCount = this.col.countDocuments(query);

		return {
			cursor,
			totalCount,
		};
	}

	/**
	 * @deprecated use {@link updateOne} or {@link updateAny} instead
	 */
	update(
		filter: Filter<T>,
		update: UpdateFilter<T> | Partial<T>,
		options?: UpdateOptions & { multi?: true },
	): Promise<UpdateResult | Document> {
		const operation = options?.multi ? 'updateMany' : 'updateOne';

		return this[operation](filter, update, options);
	}

	updateOne(filter: Filter<T>, update: UpdateFilter<T> | Partial<T>, options?: UpdateOptions): Promise<UpdateResult> {
		this.setUpdatedAt(update);
		if (options) {
			return this.col.updateOne(filter, update, options);
		}
		return this.col.updateOne(filter, update);
	}

	updateMany(filter: Filter<T>, update: UpdateFilter<T> | Partial<T>, options?: UpdateOptions): Promise<Document | UpdateResult> {
		this.setUpdatedAt(update);
		if (options) {
			return this.col.updateMany(filter, update, options);
		}
		return this.col.updateMany(filter, update);
	}

	insertMany(docs: InsertionModel<T>[], options?: BulkWriteOptions): Promise<InsertManyResult<T>> {
		docs = docs.map((doc) => {
			if (!doc._id || typeof doc._id !== 'string') {
				const oid = new ObjectId();
				return { _id: oid.toHexString(), ...doc };
			}
			this.setUpdatedAt(doc);
			return doc;
		});

		// TODO reavaluate following type casting
		return this.col.insertMany(docs as unknown as OptionalUnlessRequiredId<T>[], options || {});
	}

	insertOne(doc: InsertionModel<T>, options?: InsertOneOptions): Promise<InsertOneResult<T>> {
		if (!doc._id || typeof doc._id !== 'string') {
			const oid = new ObjectId();
			doc = { _id: oid.toHexString(), ...doc };
		}

		this.setUpdatedAt(doc);

		// TODO reavaluate following type casting
		return this.col.insertOne(doc as unknown as OptionalUnlessRequiredId<T>, options || {});
	}

	removeById(_id: T['_id']): Promise<DeleteResult> {
		return this.deleteOne({ _id } as Filter<T>);
	}

	removeByIds(ids: T['_id'][]): Promise<DeleteResult> {
		return this.deleteMany({ _id: { $in: ids } } as unknown as Filter<T>);
	}

	async deleteOne(filter: Filter<T>, options?: DeleteOptions & { bypassDocumentValidation?: boolean }): Promise<DeleteResult> {
		if (!this.trash) {
			if (options) {
				return this.col.deleteOne(filter, options);
			}
			return this.col.deleteOne(filter);
		}

		const doc = await this.findOne(filter);

		if (doc) {
			const { _id, ...record } = doc;

			const trash: TDeleted = {
				...record,
				_deletedAt: new Date(),
				__collection__: this.name,
			} as unknown as TDeleted;

			// since the operation is not atomic, we need to make sure that the record is not already deleted/inserted
			await this.trash?.updateOne({ _id } as Filter<TDeleted>, { $set: trash } as UpdateFilter<TDeleted>, {
				upsert: true,
			});
		}

		if (options) {
			return this.col.deleteOne(filter, options);
		}
		return this.col.deleteOne(filter);
	}

	async deleteMany(filter: Filter<T>, options?: DeleteOptions): Promise<DeleteResult> {
		if (!this.trash) {
			if (options) {
				return this.col.deleteMany(filter, options);
			}
			return this.col.deleteMany(filter);
		}

		const cursor = this.find(filter);

		const ids: T['_id'][] = [];
		for await (const doc of cursor) {
			const { _id, ...record } = doc as T;

			const trash: TDeleted = {
				...record,
				_deletedAt: new Date(),
				__collection__: this.name,
			} as unknown as TDeleted;

			ids.push(_id as T['_id']);

			// since the operation is not atomic, we need to make sure that the record is not already deleted/inserted
			await this.trash?.updateOne({ _id } as Filter<TDeleted>, { $set: trash } as UpdateFilter<TDeleted>, {
				upsert: true,
			});
		}

		if (options) {
			return this.col.deleteMany({ _id: { $in: ids } } as unknown as Filter<T>, options);
		}
		return this.col.deleteMany({ _id: { $in: ids } } as unknown as Filter<T>);
	}

	// Trash
	trashFind<P extends TDeleted>(
		query: Filter<TDeleted>,
		options?: FindOptions<P extends TDeleted ? TDeleted : P>,
	): FindCursor<WithId<TDeleted>> | undefined {
		if (!this.trash) {
			return undefined;
		}

		if (options) {
			return this.trash.find(
				{
					__collection__: this.name,
					...query,
				},
				options,
			);
		}

		return this.trash.find({
			__collection__: this.name,
			...query,
		});
	}

	trashFindOneById(_id: TDeleted['_id']): Promise<TDeleted | null>;

	trashFindOneById<P extends Document>(_id: TDeleted['_id'], options: FindOptions<P extends TDeleted ? TDeleted : P>): Promise<P | null>;

	async trashFindOneById<P extends TDeleted>(
		_id: TDeleted['_id'],
		options?: FindOptions<P extends TDeleted ? TDeleted : P>,
	): Promise<WithId<P | TDeleted> | null> {
		const query = {
			_id,
			__collection__: this.name,
		} as Filter<P | TDeleted>;

		if (!this.trash) {
			return null;
		}

		if (options) {
			return (this.trash as Collection<P | TDeleted>).findOne(query, options);
		}
		return (this.trash as Collection<P | TDeleted>).findOne(query);
	}

	private setUpdatedAt(record: UpdateFilter<T> | InsertionModel<T>): void {
		if (this.preventSetUpdatedAt) {
			return;
		}
		setUpdatedAt(record);
	}

	trashFindDeletedAfter(deletedAt: Date): FindCursor<WithId<TDeleted>>;

	trashFindDeletedAfter<P extends Document = TDeleted>(
		deletedAt: Date,
		query?: Filter<TDeleted>,
		options?: FindOptions<P extends TDeleted ? TDeleted : P>,
	): FindCursor<WithId<TDeleted>> {
		const q = {
			__collection__: this.name,
			_deletedAt: {
				$gt: deletedAt,
			},
			...query,
		} as Filter<TDeleted>;

		if (!this.trash) {
			throw new Error('Trash is not enabled for this collection');
		}

		if (options) {
			return this.trash.find(q, options);
		}
		return this.trash.find(q);
	}

	trashFindPaginatedDeletedAfter<P extends Document = TDeleted>(
		deletedAt: Date,
		query?: Filter<TDeleted>,
		options?: FindOptions<P extends TDeleted ? TDeleted : P>,
	): FindPaginated<FindCursor<WithId<TDeleted>>> {
		const q: Filter<TDeleted> = {
			__collection__: this.name,
			_deletedAt: {
				$gt: deletedAt,
			},
			...query,
		} as Filter<TDeleted>;

		if (!this.trash) {
			throw new Error('Trash is not enabled for this collection');
		}

		const cursor = options ? this.trash.find(q, options) : this.trash.find(q);
		const totalCount = this.trash.countDocuments(q);

		return {
			cursor,
			totalCount,
		};
	}

	watch(pipeline?: object[]): ChangeStream<T> {
		return this.col.watch(pipeline);
	}

	countDocuments(query: Filter<T>): Promise<number> {
		return this.col.countDocuments(query);
	}

	estimatedDocumentCount(): Promise<number> {
		return this.col.estimatedDocumentCount();
	}
}

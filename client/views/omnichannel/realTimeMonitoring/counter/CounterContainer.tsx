// @ts-nocheck
import { Skeleton } from '@rocket.chat/fuselage';
import React, { ReactElement, useEffect, useState } from 'react';

import { useTranslation } from '../../../../contexts/TranslationContext';
import { AsyncStatePhase } from '../../../../hooks/useAsyncState';
import CounterItem from './CounterItem';
import CounterRow from './CounterRow';

const CounterContainer = ({ data, state, initialData, ...props }): ReactElement => {
	const t = useTranslation();

	const [displayData, setDisplayData] = useState(initialData);

	const { totalizers } = data || { totalizers: initialData };

	useEffect(() => {
		if (state === AsyncStatePhase.RESOLVED) {
			setDisplayData(totalizers);
		}
	}, [state, t, totalizers]);

	return (
		<CounterRow {...props}>
			{displayData.map(({ title, value }, i) => (
				<CounterItem key={i} title={title ? t(title) : <Skeleton width='x60' />} count={value} />
			))}
		</CounterRow>
	);
};

export default CounterContainer;

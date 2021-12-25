// @ts-nocheck
import { Grid } from '@rocket.chat/fuselage';
import React, { ReactElement } from 'react';

import Counter from './Counter';

function CounterSet({ counters = [] }): ReactElement {
	return (
		<Grid>
			{counters.map(({ count, variation, description }, i) => (
				<Grid.Item key={i}>
					<Counter count={count} variation={variation} description={description} />
				</Grid.Item>
			))}
		</Grid>
	);
}

export default CounterSet;

// @ts-nocheck
import { Box } from '@rocket.chat/fuselage';
import React, { ReactElement } from 'react';

import DotLeader from '../../../components/DotLeader';

const TextSeparator = ({ label, value }): ReactElement => (
	<Box display='flex' flexDirection='row' mb='x4'>
		<Box display='inline-flex' alignItems='center'>
			{label}
		</Box>
		<DotLeader />
		<span>{value}</span>
	</Box>
);

export default TextSeparator;

// @ts-nocheck
import { Box } from '@rocket.chat/fuselage';
import React, { ReactElement } from 'react';

import BaseAvatar from './BaseAvatar';

export default function AppAvatar({ iconFileContent, size, iconFileData, ...props }): ReactElement {
	return (
		<Box {...props}>
			<BaseAvatar
				size={size}
				objectFit
				url={iconFileContent || `data:image/png;base64,${iconFileData}`}
			/>
		</Box>
	);
}

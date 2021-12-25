// @ts-nocheck
import { Box } from '@rocket.chat/fuselage';
import React, { ReactElement } from 'react';

function Timestamp({ ts }): ReactElement {
	return (
		<Box rcx-message__time fontSize='c1' color='neutral-600' flexShrink={0} withTruncatedText>
			{ts.toDateString ? ts.toDateString() : ts}
		</Box>
	);
}

export default Timestamp;

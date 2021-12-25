// @ts-nocheck
import { Box, ActionButton } from '@rocket.chat/fuselage';
import React, { ReactElement } from 'react';

const Header = ({ title, onClose, children = undefined, ...props }): ReactElement => (
	<Box is='header' display='flex' flexDirection='column' pb='x16' {...props}>
		{(title || onClose) && (
			<Box
				display='flex'
				flexDirection='row'
				alignItems='center'
				pi='x24'
				justifyContent='space-between'
				flexGrow={1}
			>
				{title && (
					<Box color='neutral-800' fontSize='p3' fontWeight='p3' flexShrink={1} withTruncatedText>
						{title}
					</Box>
				)}
				{onClose && <ActionButton ghost small icon='cross' onClick={onClose} />}
			</Box>
		)}
		{children}
	</Box>
);

export default Header;

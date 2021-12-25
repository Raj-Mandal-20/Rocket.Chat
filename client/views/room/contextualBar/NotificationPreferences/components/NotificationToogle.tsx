// @ts-nocheck
import { Box, Field, FieldGroup, ToggleSwitch } from '@rocket.chat/fuselage';
import { useUniqueId } from '@rocket.chat/fuselage-hooks';
import React, { memo, ReactElement } from 'react';

const NotificationToogle = ({ label, description, onChange, defaultChecked }): ReactElement => {
	const id = useUniqueId();

	return (
		<FieldGroup>
			<Box display='flex' justifyContent='space-between' alignItems='start'>
				<Box display='flex' flexDirection='column'>
					<Field.Label htmlFor={id}>{label}</Field.Label>
					<Field.Description>{description}</Field.Description>
				</Box>
				<ToggleSwitch id={id} onChange={onChange} defaultChecked={defaultChecked} />
			</Box>
		</FieldGroup>
	);
};

export default memo(NotificationToogle);

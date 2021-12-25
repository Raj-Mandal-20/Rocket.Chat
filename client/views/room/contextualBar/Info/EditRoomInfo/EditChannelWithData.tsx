// @ts-nocheck
import React, { ReactElement } from 'react';

import { useUserRoom } from '../../../hooks/useUserRoom';
import { useTabBarClose } from '../../../providers/ToolboxProvider';
import EditChannel from './EditChannel';

function EditChannelWithData({ rid, onClickBack }): ReactElement {
	const room = useUserRoom(rid);
	const onClickClose = useTabBarClose();

	return (
		<EditChannel
			onClickClose={onClickClose}
			onClickBack={onClickBack}
			room={{ type: room?.t, ...room }}
		/>
	);
}

export default EditChannelWithData;

// @ts-nocheck
import React, { ReactElement } from 'react';

import GenericModal from '../../../../../components/GenericModal';
import { useTranslation } from '../../../../../contexts/TranslationContext';
import ChannelDesertionTable from '../../../ChannelDesertionTable';

export const StepOne = ({
	rooms,
	lastOwnerRooms,
	onToggleAllRooms,
	onChangeRoomSelection,
	onConfirm,
	onCancel,
	eligibleRoomsLength,
	selectedRooms,
}): ReactElement => {
	const t = useTranslation();

	return (
		<GenericModal
			variant='warning'
			title={t('Teams_leave')}
			onConfirm={onConfirm}
			onCancel={onCancel}
			onClose={onCancel}
			confirmText={t('Continue')}
		>
			{t('Teams_leave_channels')}
			<ChannelDesertionTable
				lastOwnerWarning={t('Teams_channels_last_owner_leave_channel_warning')}
				onToggleAllRooms={onToggleAllRooms}
				lastOwnerRooms={lastOwnerRooms}
				eligibleRoomsLength={eligibleRoomsLength}
				rooms={rooms}
				params={{}}
				onChangeParams={(): void => undefined}
				onChangeRoomSelection={onChangeRoomSelection}
				selectedRooms={selectedRooms}
			/>
		</GenericModal>
	);
};

export default StepOne;

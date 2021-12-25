// @ts-nocheck
import { Options } from '@rocket.chat/fuselage';
import React, { ReactElement } from 'react';

import RoomAvatar from '../avatar/RoomAvatar';

const Avatar = ({ value, type, avatarETag, ...props }): ReactElement => (
	<RoomAvatar size={Options.AvatarSize} room={{ type, _id: value, avatarETag }} {...props} />
);

export default Avatar;

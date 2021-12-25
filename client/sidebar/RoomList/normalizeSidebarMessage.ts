// @ts-nocheck
import { escapeHTML } from '@rocket.chat/string-helpers';

import { filterMarkdown } from '../../../app/markdown/lib/markdown';

export const normalizeSidebarMessage = (message, t): string | undefined => {
	if (message.msg) {
		return escapeHTML(filterMarkdown(message.msg));
	}

	if (message.attachments) {
		const attachment = message.attachments.find(
			(attachment) => attachment.title || attachment.description,
		);

		if (attachment?.description) {
			return escapeHTML(attachment.description);
		}

		if (attachment?.title) {
			return escapeHTML(attachment.title);
		}

		return t('Sent_an_attachment');
	}
};

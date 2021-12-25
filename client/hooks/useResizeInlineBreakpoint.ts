// @ts-nocheck
import { useResizeObserver, useStableArray } from '@rocket.chat/fuselage-hooks';
import { useMemo } from 'react';

export const useResizeInlineBreakpoint = (
	sizes = [],
	debounceDelay = 0,
): [ref: unknown, ...rest: unknown[]] => {
	const { ref, borderBoxSize } = useResizeObserver({ debounceDelay });
	const inlineSize = borderBoxSize ? borderBoxSize.inlineSize : 0;
	const stableSizes = useStableArray(sizes);
	const newSizes = useMemo(
		() => stableSizes.map((current) => (inlineSize ? inlineSize > current : true)),
		[inlineSize, stableSizes],
	);
	return [ref, ...newSizes];
};

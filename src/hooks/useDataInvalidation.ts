'use client'

import { useEffect, useRef } from 'react'
import {
    type DataTag,
    matchesInvalidation,
    subscribeToInvalidation,
} from '@/lib/client/data-sync'

export function useDataInvalidation(
    watchedTags: readonly DataTag[],
    onInvalidate: () => void
) {
    const callbackRef = useRef(onInvalidate)

    useEffect(() => {
        callbackRef.current = onInvalidate
    }, [onInvalidate])

    useEffect(() => {
        return subscribeToInvalidation((invalidatedTags) => {
            if (matchesInvalidation(watchedTags, invalidatedTags)) {
                callbackRef.current()
            }
        })
    }, [watchedTags])
}

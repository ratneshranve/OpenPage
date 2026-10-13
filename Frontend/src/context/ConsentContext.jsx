import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { post } from '../lib/api';
import { configureTracking } from '../lib/tracking';
import { useConfig } from './ConfigContext';

/**
 * Central consent layer. Essential cookies are always on; analytics and advertising are off
 * until the visitor chooses. Tracking scripts are configured only from here.
 */
const ConsentContext = createContext(null);
const KEY = 'op_consent_v1';

const read = () => {
    try {
        return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
        return null;
    }
};

const visitorId = () => {
    try {
        let id = localStorage.getItem('op_visitor');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('op_visitor', id);
        }
        return id;
    } catch {
        return 'anonymous';
    }
};

export function ConsentProvider({ children }) {
    const { config } = useConfig();
    const [consent, setConsent] = useState(read);
    const policyVersion = config?.tracking?.consent?.policyVersion;
    const required = config?.tracking?.consent?.requireConsent !== false;

    // A new policy version asks again.
    const decided = Boolean(consent && (!policyVersion || consent.policyVersion === policyVersion));
    const effective = decided ? consent : required ? { analytics: false, advertising: false } : { analytics: true, advertising: true };

    useEffect(() => {
        if (config) configureTracking(config.tracking, { analytics: effective.analytics, advertising: effective.advertising });
    }, [config, effective.analytics, effective.advertising]);

    const save = useCallback(
        (choice, action) => {
            const value = { analytics: Boolean(choice.analytics), advertising: Boolean(choice.advertising), policyVersion, at: new Date().toISOString() };
            setConsent(value);
            try {
                localStorage.setItem(KEY, JSON.stringify(value));
            } catch {
                /* ignore */
            }
            post('/consent', { visitorId: visitorId(), analytics: value.analytics, advertising: value.advertising, policyVersion, action }).catch(() => {});
        },
        [policyVersion]
    );

    const showBanner = Boolean(config && config.tracking?.consent?.bannerEnabled && !decided && (config.tracking.meta.enabled || config.tracking.googleAds.enabled || config.tracking.adsense.enabled || required));

    return (
        <ConsentContext.Provider
            value={{
                consent: effective,
                decided,
                showBanner,
                acceptAll: () => save({ analytics: true, advertising: true }, 'accept_all'),
                rejectAll: () => save({ analytics: false, advertising: false }, 'reject_all'),
                saveCustom: (c) => save(c, 'custom'),
                withdraw: () => save({ analytics: false, advertising: false }, 'withdraw'),
            }}
        >
            {children}
        </ConsentContext.Provider>
    );
}

export const useConsent = () => useContext(ConsentContext);

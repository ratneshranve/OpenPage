import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get } from '../lib/api';

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
    const [config, setConfig] = useState(null);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            setConfig(await get('/config/public'));
        } catch (err) {
            setError(err);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return <ConfigContext.Provider value={{ config, error, reload: load }}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);

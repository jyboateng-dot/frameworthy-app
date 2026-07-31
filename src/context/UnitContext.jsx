import React, { createContext, useContext, useState } from 'react';

const UnitContext = createContext();

const loadStoredUnit = () => {
    const storedUnit = localStorage.getItem('fw_unit_preference');
    return storedUnit === 'in' || storedUnit === 'cm' ? storedUnit : 'cm';
};

export const UnitProvider = ({ children }) => {
    const [unit, setUnitState] = useState(loadStoredUnit);

    const setUnit = (newUnit) => {
        setUnitState(newUnit);
        localStorage.setItem('fw_unit_preference', newUnit);
    };

    return (
        <UnitContext.Provider value={{ unit, setUnit }}>
            {children}
        </UnitContext.Provider>
    );
};

export const useUnit = () => useContext(UnitContext);

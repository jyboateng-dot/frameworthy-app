import React, { createContext, useContext, useState, useEffect } from 'react';

const UnitContext = createContext();

export const UnitProvider = ({ children }) => {
    const [unit, setUnitState] = useState('cm');

    useEffect(() => {
        const storedUnit = localStorage.getItem('fw_unit_preference');
        if (storedUnit === 'in' || storedUnit === 'cm') {
            setUnitState(storedUnit);
        }
    }, []);

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

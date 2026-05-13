/**
 * Food Safety Policy Boxes
 * HACCP and food safety compliance rules
 */

const foodSafetyBoxes = [
    {
        id: 'reheating_temperature',
        name: 'Opvarmning Temperaturkontrol',
        domain: 'food_safety',
        ruleFamily: 'temperature_control',
        tags: ['reheating', 'temperature', 'ccp'],
        rules: [
            {
                id: 'reheating_min_75c',
                message: 'Opvarmning skal nå mindst 75°C',
                severity: 'critical',
                evaluate: (input) => {
                    const temp = input.temperature || input.finalTemperature || input.measuredTemperature;
                    
                    if (temp === null || temp === undefined) {
                        return {
                            passed: false,
                            message: 'Temperatur ikke målt',
                            value: null,
                            threshold: 75
                        };
                    }

                    const passed = temp >= 75;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Temperatur OK: ${temp}°C` 
                            : `Temperatur for lav: ${temp}°C (krævet: ≥75°C)`,
                        value: temp,
                        threshold: 75
                    };
                }
            }
        ]
    },

    {
        id: 'hot_holding_temperature',
        name: 'Varmholdelse Temperaturkontrol',
        domain: 'food_safety',
        ruleFamily: 'temperature_control',
        tags: ['hot_holding', 'temperature', 'ccp'],
        rules: [
            {
                id: 'hot_holding_min_65c',
                message: 'Varmholdelse skal være mindst 65°C',
                severity: 'critical',
                evaluate: (input) => {
                    const temp = input.temperature || input.measuredTemperature;
                    
                    if (temp === null || temp === undefined) {
                        return {
                            passed: false,
                            message: 'Temperatur ikke målt',
                            value: null,
                            threshold: 65
                        };
                    }

                    const passed = temp >= 65;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Temperatur OK: ${temp}°C` 
                            : `Temperatur for lav: ${temp}°C (krævet: ≥65°C)`,
                        value: temp,
                        threshold: 65
                    };
                }
            }
        ]
    },

    {
        id: 'cooling_control',
        name: 'Nedkøling Tidskontrol',
        domain: 'food_safety',
        ruleFamily: 'temperature_control',
        tags: ['cooling', 'temperature', 'time', 'ccp'],
        rules: [
            {
                id: 'cooling_65_to_10_within_4h',
                message: 'Nedkøling fra 65°C til 10°C skal ske inden 4 timer',
                severity: 'critical',
                evaluate: (input) => {
                    const startTemp = input.startTemperature || input.startTemp;
                    const endTemp = input.endTemperature || input.endTemp;
                    const durationMinutes = input.durationMinutes;
                    
                    if (startTemp === null || startTemp === undefined) {
                        return {
                            passed: false,
                            message: 'Start temperatur ikke målt',
                            value: null,
                            threshold: 65
                        };
                    }

                    if (endTemp === null || endTemp === undefined) {
                        return {
                            passed: false,
                            message: 'Slut temperatur ikke målt',
                            value: null,
                            threshold: 10
                        };
                    }

                    if (durationMinutes === null || durationMinutes === undefined) {
                        return {
                            passed: false,
                            message: 'Varighed ikke registreret',
                            value: null,
                            threshold: 240
                        };
                    }

                    // Check temperature range
                    const tempOk = startTemp >= 65 && endTemp <= 10;
                    // Check time limit (4 hours = 240 minutes)
                    const timeOk = durationMinutes <= 240;
                    
                    const passed = tempOk && timeOk;
                    
                    let message = '';
                    if (!tempOk) {
                        message = `Temperaturinterval ikke korrekt: ${startTemp}°C → ${endTemp}°C (krævet: ≥65°C → ≤10°C)`;
                    } else if (!timeOk) {
                        message = `Nedkøling tog for lang tid: ${durationMinutes} min (max: 240 min)`;
                    } else {
                        message = `Nedkøling OK: ${startTemp}°C → ${endTemp}°C på ${durationMinutes} min`;
                    }
                    
                    return {
                        passed,
                        message,
                        value: { startTemp, endTemp, durationMinutes },
                        threshold: { startTemp: 65, endTemp: 10, maxMinutes: 240 }
                    };
                }
            }
        ]
    },

    {
        id: 'goods_receiving_temperature',
        name: 'Varemodtagelse Temperaturkontrol',
        domain: 'food_safety',
        ruleFamily: 'temperature_control',
        tags: ['receiving', 'temperature', 'ccp'],
        rules: [
            {
                id: 'receiving_cold_max_5c',
                message: 'Kølevarer skal modtages ved max 5°C',
                severity: 'high',
                evaluate: (input) => {
                    const temp = input.temperature || input.measuredTemperature;
                    const productType = input.productType || input.type;
                    
                    // Only apply to cold products
                    if (productType !== 'cold' && productType !== 'refrigerated') {
                        return { passed: true, message: 'Ikke relevant for produkttype' };
                    }
                    
                    if (temp === null || temp === undefined) {
                        return {
                            passed: false,
                            message: 'Temperatur ikke målt',
                            value: null,
                            threshold: 5
                        };
                    }

                    const passed = temp <= 5;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Temperatur OK: ${temp}°C` 
                            : `Temperatur for høj: ${temp}°C (max: 5°C)`,
                        value: temp,
                        threshold: 5
                    };
                }
            },
            {
                id: 'receiving_frozen_max_minus_18c',
                message: 'Frostvarer skal modtages ved max -18°C',
                severity: 'high',
                evaluate: (input) => {
                    const temp = input.temperature || input.measuredTemperature;
                    const productType = input.productType || input.type;
                    
                    // Only apply to frozen products
                    if (productType !== 'frozen') {
                        return { passed: true, message: 'Ikke relevant for produkttype' };
                    }
                    
                    if (temp === null || temp === undefined) {
                        return {
                            passed: false,
                            message: 'Temperatur ikke målt',
                            value: null,
                            threshold: -18
                        };
                    }

                    const passed = temp <= -18;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Temperatur OK: ${temp}°C` 
                            : `Temperatur for høj: ${temp}°C (max: -18°C)`,
                        value: temp,
                        threshold: -18
                    };
                }
            }
        ]
    }
];

export default foodSafetyBoxes;

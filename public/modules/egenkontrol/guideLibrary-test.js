// Test file to verify guideLibrary.js exports correctly
import { getGuideForTask, getGuideByKey, mapCategoryToGuideKey } from './guideLibrary.js';

console.log('TEST: guideLibrary exports', {
    getGuideForTask: typeof getGuideForTask,
    getGuideByKey: typeof getGuideByKey,
    mapCategoryToGuideKey: typeof mapCategoryToGuideKey
});

// Test basic functionality
const testTask = {
    guideKey: 'fridge_temperature',
    title: 'Test Task'
};

const guide = getGuideForTask(testTask);
console.log('TEST: getGuideForTask result', guide ? guide.title : 'null');

export { getGuideForTask, getGuideByKey, mapCategoryToGuideKey };

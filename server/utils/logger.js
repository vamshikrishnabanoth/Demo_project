// utils/logger.js
const colors = {
    step: '\x1b[36m%s\x1b[0m',     // Cyan
    data: '\x1b[32m%s\x1b[0m',     // Green
    divider: '\x1b[90m%s\x1b[0m'   // Gray
};

function logPipelineStep(stepNumber, stepName, dataDescription, payload) {
    console.log(colors.divider, "\n========================================================");
    console.log(colors.step, `➡️ [STEP ${stepNumber}] ${stepName}`);
    console.log(colors.divider, `📋 Data State: ${dataDescription}`);
    console.log(colors.divider, "--------------------------------------------------------");
    
    if (typeof payload === 'object') {
        console.dir(payload, { depth: null, colors: true });
    } else {
        console.log(colors.data, payload);
    }
    console.log(colors.divider, "========================================================\n");
}

module.exports = { logPipelineStep };

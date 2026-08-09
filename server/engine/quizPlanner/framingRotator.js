const { PLANNER_CONFIG } = require('../../config/plannerConfig');

/**
 * Pass 3: Framing Style Rotation & Code/Math Overrides (framingRotator.js)
 */
function rotateFramingStyles(allocatedConceptNodes = []) {
  const defaultRotation = ["DEFINITION", "SCENARIO", "COMPARATIVE"];
  let rotIdx = 0;
  let framingConflictsResolved = 0;

  const slotFramings = allocatedConceptNodes.map((conceptNode, idx) => {
    if (conceptNode?.hasCodeOrMath) {
      framingConflictsResolved++;
      return (idx % 2 === 0) ? "CALCULATION" : "TROUBLESHOOTING";
    }

    const assignedStyle = defaultRotation[rotIdx % defaultRotation.length];
    rotIdx++;
    return assignedStyle;
  });

  return {
    slotFramings,
    framingConflictsResolved,
    framingStrategy: "RoundRobinWithCodeOverride"
  };
}

module.exports = {
  rotateFramingStyles
};

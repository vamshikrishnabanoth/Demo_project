const { COMPACT_EXEMPLARS } = require('./exemplars');

/**
 * Exemplar Selector: Retrieves compact exemplar matching expected framing style
 */
function getExemplarForFraming(framingStyle = "DEFINITION") {
  const style = String(framingStyle).toUpperCase();
  return COMPACT_EXEMPLARS[style] || COMPACT_EXEMPLARS.DEFINITION;
}

module.exports = {
  getExemplarForFraming
};

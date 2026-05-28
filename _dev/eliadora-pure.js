import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EliadoraPure = require('../eliadora-pure.js');

export default EliadoraPure;
export const {
  esc,
  escAttr,
  normalizePeople,
  isAncestor,
  applyParentLink,
  findDuplicate,
  ageSanityWarning,
  extractEliadoraDataFromText,
  safeJsonForHtmlScript,
  buildSavable
} = EliadoraPure;

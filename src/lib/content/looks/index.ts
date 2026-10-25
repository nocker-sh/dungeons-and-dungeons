/** 見た目の公開API。JSON境界・人物・戦闘素材・背景・街・台詞を分離する。 */
export {
  PLACEHOLDER,
  personOf,
  portraitOf,
  skillPortraitOf,
  specialArtOf,
  frameOf,
  type Frame,
} from "./people"
export { DEMON_ART, FOE_ART } from "./combat-art"
export {
  sceneOf,
  battleSceneOf,
  entranceOf,
  standOf,
  placeIdOf,
  placeSlug,
  placeName,
  layerScenes,
  layerSceneArt,
  layerLook,
} from "./places"
export { personFor, shopLook, street, goodIconKey } from "./town"
export {
  keeperOf,
  roomLine,
  guideLine,
  nightTalks,
  type Keeper,
} from "./dialogue"
export type { Stand, LayerSceneArt, NightTalk } from "./types"

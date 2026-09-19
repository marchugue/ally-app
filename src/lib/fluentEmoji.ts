/**
 * Microsoft Fluent 3D Emojis CDN Mapping
 * Supports both animated 3D APNGs (for quick reactions) and pure static 3D renders.
 */

const ANIMATED_BASE = 'https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Animated-Fluent-Emojis@master/Emojis';
const STATIC_3D_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

/**
 * Animated Microsoft Fluent 3D Emojis (60fps APNG with alpha transparency)
 * Used for Quick Reactions bars and interactive reaction animations.
 */
export const ANIMATED_FLUENT_EMOJI_MAP: Record<string, string> = {
  // Quick Reactions
  '👍': `${ANIMATED_BASE}/Hand%20gestures/Thumbs%20Up.png`,
  '👎': `${ANIMATED_BASE}/Hand%20gestures/Thumbs%20Down.png`,
  '❤️': `${ANIMATED_BASE}/Smilies/Red%20Heart.png`,
  '😂': `${ANIMATED_BASE}/Smilies/Face%20with%20Tears%20of%20Joy.png`,
  '🤣': `${ANIMATED_BASE}/Smilies/Rolling%20on%20the%20Floor%20Laughing.png`,
  '😮': `${ANIMATED_BASE}/Smilies/Face%20with%20Open%20Mouth.png`,
  '😢': `${ANIMATED_BASE}/Smilies/Crying%20Face.png`,
  '😭': `${ANIMATED_BASE}/Smilies/Loudly%20Crying%20Face.png`,
  '🙏': `${ANIMATED_BASE}/Hand%20gestures/Folded%20Hands.png`,

  // Popular Smilies & Faces
  '😍': `${ANIMATED_BASE}/Smilies/Smiling%20Face%20with%20Heart-Eyes.png`,
  '🥰': `${ANIMATED_BASE}/Smilies/Smiling%20Face%20with%20Hearts.png`,
  '😘': `${ANIMATED_BASE}/Smilies/Face%20Blowing%20a%20Kiss.png`,
  '😊': `${ANIMATED_BASE}/Smilies/Smiling%20Face%20with%20Smiling%20Eyes.png`,
  '🥳': `${ANIMATED_BASE}/Smilies/Partying%20Face.png`,
  '🤔': `${ANIMATED_BASE}/Smilies/Thinking%20Face.png`,
  '🥺': `${ANIMATED_BASE}/Smilies/Pleading%20Face.png`,
  '😎': `${ANIMATED_BASE}/Smilies/Smiling%20Face%20with%20Sunglasses.png`,
  '🤩': `${ANIMATED_BASE}/Smilies/Star-Struck.png`,
  '😱': `${ANIMATED_BASE}/Smilies/Face%20Screaming%20in%20Fear.png`,
  '🙄': `${ANIMATED_BASE}/Smilies/Face%20with%20Rolling%20Eyes.png`,
  '🤯': `${ANIMATED_BASE}/Smilies/Exploding%20Head.png`,
  '😡': `${ANIMATED_BASE}/Smilies/Enraged%20Face.png`,
  '🫡': `${ANIMATED_BASE}/Smilies/Saluting%20Face.png`,
  '🥹': `${ANIMATED_BASE}/Smilies/Face%20Holding%20Back%20Tears.png`,
  '💀': `${ANIMATED_BASE}/Smilies/Skull.png`,
  '💩': `${ANIMATED_BASE}/Smilies/Pile%20of%20Poo.png`,
  '🤡': `${ANIMATED_BASE}/Smilies/Clown%20Face.png`,
  'ghost': `${ANIMATED_BASE}/Smilies/Ghost.png`,
  '👻': `${ANIMATED_BASE}/Smilies/Ghost.png`,

  // Hand Gestures
  '👏': `${ANIMATED_BASE}/Hand%20gestures/Clapping%20Hands.png`,
  '🙌': `${ANIMATED_BASE}/Hand%20gestures/Raising%20Hands.png`,
  '🤝': `${ANIMATED_BASE}/Hand%20gestures/Handshake.png`,
  '✌️': `${ANIMATED_BASE}/Hand%20gestures/Victory%20Hand.png`,
  '🤞': `${ANIMATED_BASE}/Hand%20gestures/Crossed%20Fingers.png`,
  '🫶': `${ANIMATED_BASE}/Hand%20gestures/Heart%20Hands.png`,
  '💪': `${ANIMATED_BASE}/Hand%20gestures/Flexed%20Biceps.png`,

  // Hearts & Symbols
  '🔥': `${ANIMATED_BASE}/Travel%20and%20places/Fire.png`,
  '🎉': `${ANIMATED_BASE}/Activities/Party%20Popper.png`,
  '✨': `${ANIMATED_BASE}/Activities/Sparkles.png`,
  '💯': `${ANIMATED_BASE}/Smilies/Hundred%20Points.png`,
  '🧡': `${ANIMATED_BASE}/Smilies/Orange%20Heart.png`,
  '💛': `${ANIMATED_BASE}/Smilies/Yellow%20Heart.png`,
  '💚': `${ANIMATED_BASE}/Smilies/Green%20Heart.png`,
  '💙': `${ANIMATED_BASE}/Smilies/Blue%20Heart.png`,
  '💜': `${ANIMATED_BASE}/Smilies/Purple%20Heart.png`,
  '🖤': `${ANIMATED_BASE}/Smilies/Black%20Heart.png`,
  '🤍': `${ANIMATED_BASE}/Smilies/White%20Heart.png`,
  '🤎': `${ANIMATED_BASE}/Smilies/Brown%20Heart.png`,
  '💔': `${ANIMATED_BASE}/Smilies/Broken%20Heart.png`,
  '💖': `${ANIMATED_BASE}/Smilies/Sparkling%20Heart.png`,
  '💗': `${ANIMATED_BASE}/Smilies/Growing%20Heart.png`,
  '💓': `${ANIMATED_BASE}/Smilies/Beating%20Heart.png`,
  '💞': `${ANIMATED_BASE}/Smilies/Revolving%20Hearts.png`,
  '💕': `${ANIMATED_BASE}/Smilies/Two%20Hearts.png`,
  '⭐': `${ANIMATED_BASE}/Travel%20and%20places/Star.png`,
  '🌟': `${ANIMATED_BASE}/Travel%20and%20places/Glowing%20Star.png`,
  '🚀': `${ANIMATED_BASE}/Travel%20and%20places/Rocket.png`,
  '🏆': `${ANIMATED_BASE}/Activities/Trophy.png`,
  '🎯': `${ANIMATED_BASE}/Activities/Bullseye.png`,
  '💡': `${ANIMATED_BASE}/Objects/Light%20Bulb.png`,
  '⚡': `${ANIMATED_BASE}/Travel%20and%20places/High%20Voltage.png`,
  '👑': `${ANIMATED_BASE}/Objects/Crown.png`,
};

/**
 * Official Microsoft Fluent 3D static renders from microsoft/fluentui-emoji.
 */
export const FLUENT_EMOJI_MAP: Record<string, string> = {
  // Quick Reactions
  '👍': `${STATIC_3D_BASE}/Thumbs%20up/Default/3D/thumbs_up_3d_default.png`,
  '👎': `${STATIC_3D_BASE}/Thumbs%20down/Default/3D/thumbs_down_3d_default.png`,
  '❤️': `${STATIC_3D_BASE}/Red%20heart/3D/red_heart_3d.png`,
  '😂': `${STATIC_3D_BASE}/Face%20with%20tears%20of%20joy/3D/face_with_tears_of_joy_3d.png`,
  '🤣': `${STATIC_3D_BASE}/Rolling%20on%20the%20floor%20laughing/3D/rolling_on_the_floor_laughing_3d.png`,
  '😮': `${STATIC_3D_BASE}/Face%20with%20open%20mouth/3D/face_with_open_mouth_3d.png`,
  '😢': `${STATIC_3D_BASE}/Crying%20face/3D/crying_face_3d.png`,
  '😭': `${STATIC_3D_BASE}/Loudly%20crying%20face/3D/loudly_crying_face_3d.png`,
  '🙏': `${STATIC_3D_BASE}/Folded%20hands/Default/3D/folded_hands_3d_default.png`,

  // Popular Smilies & Faces
  '😍': `${STATIC_3D_BASE}/Smiling%20face%20with%20heart-eyes/3D/smiling_face_with_heart-eyes_3d.png`,
  '🥰': `${STATIC_3D_BASE}/Smiling%20face%20with%20hearts/3D/smiling_face_with_hearts_3d.png`,
  '😘': `${STATIC_3D_BASE}/Face%20blowing%20a%20kiss/3D/face_blowing_a_kiss_3d.png`,
  '😊': `${STATIC_3D_BASE}/Smiling%20face%20with%20smiling%20eyes/3D/smiling_face_with_smiling_eyes_3d.png`,
  '🥳': `${STATIC_3D_BASE}/Partying%20face/3D/partying_face_3d.png`,
  '🤔': `${STATIC_3D_BASE}/Thinking%20face/3D/thinking_face_3d.png`,
  '🥺': `${STATIC_3D_BASE}/Pleading%20face/3D/pleading_face_3d.png`,
  '😎': `${STATIC_3D_BASE}/Smiling%20face%20with%20sunglasses/3D/smiling_face_with_sunglasses_3d.png`,
  '🤩': `${STATIC_3D_BASE}/Star-struck/3D/star-struck_3d.png`,
  '😱': `${STATIC_3D_BASE}/Face%20screaming%20in%20fear/3D/face_screaming_in_fear_3d.png`,
  '🙄': `${STATIC_3D_BASE}/Face%20with%20rolling%20eyes/3D/face_with_rolling_eyes_3d.png`,
  '🤯': `${STATIC_3D_BASE}/Exploding%20head/3D/exploding_head_3d.png`,
  '😡': `${STATIC_3D_BASE}/Pouting%20face/3D/pouting_face_3d.png`,
  '😠': `${STATIC_3D_BASE}/Angry%20face/3D/angry_face_3d.png`,
  '🫡': `${STATIC_3D_BASE}/Saluting%20face/3D/saluting_face_3d.png`,
  '🫠': `${STATIC_3D_BASE}/Melting%20face/3D/melting_face_3d.png`,
  '🥹': `${STATIC_3D_BASE}/Face%20holding%20back%20tears/3D/face_holding_back_tears_3d.png`,
  '🤤': `${STATIC_3D_BASE}/Drooling%20face/3D/drooling_face_3d.png`,
  '😴': `${STATIC_3D_BASE}/Sleeping%20face/3D/sleeping_face_3d.png`,
  '🤐': `${STATIC_3D_BASE}/Zipper-mouth%20face/3D/zipper-mouth_face_3d.png`,
  '🤫': `${STATIC_3D_BASE}/Shushing%20face/3D/shushing_face_3d.png`,
  '🤭': `${STATIC_3D_BASE}/Face%20with%20hand%20over%20mouth/3D/face_with_hand_over_mouth_3d.png`,
  '🥱': `${STATIC_3D_BASE}/Yawning%20face/3D/yawning_face_3d.png`,
  '🤮': `${STATIC_3D_BASE}/Face%20vomiting/3D/face_vomiting_3d.png`,
  '🤢': `${STATIC_3D_BASE}/Nauseated%20face/3D/nauseated_face_3d.png`,
  '🥵': `${STATIC_3D_BASE}/Hot%20face/3D/hot_face_3d.png`,
  '🥶': `${STATIC_3D_BASE}/Cold%20face/3D/cold_face_3d.png`,
  '🥴': `${STATIC_3D_BASE}/Woozy%20face/3D/woozy_face_3d.png`,
  '🤠': `${STATIC_3D_BASE}/Cowboy%20hat%20face/3D/cowboy_hat_face_3d.png`,
  '🤓': `${STATIC_3D_BASE}/Nerd%20face/3D/nerd_face_3d.png`,
  '🧐': `${STATIC_3D_BASE}/Face%20with%20monocle/3D/face_with_monocle_3d.png`,
  '😐': `${STATIC_3D_BASE}/Neutral%20face/3D/neutral_face_3d.png`,
  '😑': `${STATIC_3D_BASE}/Expressionless%20face/3D/expressionless_face_3d.png`,
  '😶': `${STATIC_3D_BASE}/Face%20without%20mouth/3D/face_without_mouth_3d.png`,
  '😏': `${STATIC_3D_BASE}/Smirking%20face/3D/smirking_face_3d.png`,
  '😒': `${STATIC_3D_BASE}/Unamused%20face/3D/unamused_face_3d.png`,
  '😬': `${STATIC_3D_BASE}/Grimacing%20face/3D/grimacing_face_3d.png`,
  '😌': `${STATIC_3D_BASE}/Relieved%20face/3D/relieved_face_3d.png`,
  '😔': `${STATIC_3D_BASE}/Pensive%20face/3D/pensive_face_3d.png`,
  '😷': `${STATIC_3D_BASE}/Face%20with%20medical%20mask/3D/face_with_medical_mask_3d.png`,
  '💀': `${STATIC_3D_BASE}/Skull/3D/skull_3d.png`,
  '💩': `${STATIC_3D_BASE}/Pile%20of%20poo/3D/pile_of_poo_3d.png`,
  '🤡': `${STATIC_3D_BASE}/Clown%20face/3D/clown_face_3d.png`,
  'ghost': `${STATIC_3D_BASE}/Ghost/3D/ghost_3d.png`,
  '👻': `${STATIC_3D_BASE}/Ghost/3D/ghost_3d.png`,

  // Hand Gestures
  '👋': `${STATIC_3D_BASE}/Waving%20hand/Default/3D/waving_hand_3d_default.png`,
  '👌': `${STATIC_3D_BASE}/Ok%20hand/Default/3D/ok_hand_3d_default.png`,
  '👏': `${STATIC_3D_BASE}/Clapping%20hands/Default/3D/clapping_hands_3d_default.png`,
  '🙌': `${STATIC_3D_BASE}/Raising%20hands/Default/3D/raising_hands_3d_default.png`,
  '🤝': `${STATIC_3D_BASE}/Handshake/3D/handshake_3d.png`,
  '✌️': `${STATIC_3D_BASE}/Victory%20hand/Default/3D/victory_hand_3d_default.png`,
  '🤞': `${STATIC_3D_BASE}/Crossed%20fingers/Default/3D/crossed_fingers_3d_default.png`,
  '🤙': `${STATIC_3D_BASE}/Call%20me%20hand/Default/3D/call_me_hand_3d_default.png`,
  '👈': `${STATIC_3D_BASE}/Backhand%20index%20pointing%20left/Default/3D/backhand_index_pointing_left_3d_default.png`,
  '👉': `${STATIC_3D_BASE}/Backhand%20index%20pointing%20right/Default/3D/backhand_index_pointing_right_3d_default.png`,
  '👆': `${STATIC_3D_BASE}/Backhand%20index%20pointing%20up/Default/3D/backhand_index_pointing_up_3d_default.png`,
  '👇': `${STATIC_3D_BASE}/Backhand%20index%20pointing%20down/Default/3D/backhand_index_pointing_down_3d_default.png`,
  '🫶': `${STATIC_3D_BASE}/Heart%20hands/Default/3D/heart_hands_3d_default.png`,
  '💪': `${STATIC_3D_BASE}/Flexed%20biceps/Default/3D/flexed_biceps_3d_default.png`,
  '👀': `${STATIC_3D_BASE}/Eyes/3D/eyes_3d.png`,

  // Hearts & Symbols
  '🔥': `${STATIC_3D_BASE}/Fire/3D/fire_3d.png`,
  '🎉': `${STATIC_3D_BASE}/Party%20popper/3D/party_popper_3d.png`,
  '✨': `${STATIC_3D_BASE}/Sparkles/3D/sparkles_3d.png`,
  '💯': `${STATIC_3D_BASE}/Hundred%20points/3D/hundred_points_3d.png`,
  '🧡': `${STATIC_3D_BASE}/Orange%20heart/3D/orange_heart_3d.png`,
  '💛': `${STATIC_3D_BASE}/Yellow%20heart/3D/yellow_heart_3d.png`,
  '💚': `${STATIC_3D_BASE}/Green%20heart/3D/green_heart_3d.png`,
  '💙': `${STATIC_3D_BASE}/Blue%20heart/3D/blue_heart_3d.png`,
  '💜': `${STATIC_3D_BASE}/Purple%20heart/3D/purple_heart_3d.png`,
  '🖤': `${STATIC_3D_BASE}/Black%20heart/3D/black_heart_3d.png`,
  '🤍': `${STATIC_3D_BASE}/White%20heart/3D/white_heart_3d.png`,
  '🤎': `${STATIC_3D_BASE}/Brown%20heart/3D/brown_heart_3d.png`,
  '💔': `${STATIC_3D_BASE}/Broken%20heart/3D/broken_heart_3d.png`,
  '💖': `${STATIC_3D_BASE}/Sparkling%20heart/3D/sparkling_heart_3d.png`,
  '💗': `${STATIC_3D_BASE}/Growing%20heart/3D/growing_heart_3d.png`,
  '💓': `${STATIC_3D_BASE}/Beating%20heart/3D/beating_heart_3d.png`,
  '💞': `${STATIC_3D_BASE}/Revolving%20hearts/3D/revolving_hearts_3d.png`,
  '💕': `${STATIC_3D_BASE}/Two%20hearts/3D/two_hearts_3d.png`,
  '⭐': `${STATIC_3D_BASE}/Star/3D/star_3d.png`,
  '🌟': `${STATIC_3D_BASE}/Glowing%20star/3D/glowing_star_3d.png`,
  '🚀': `${STATIC_3D_BASE}/Rocket/3D/rocket_3d.png`,
  '🏆': `${STATIC_3D_BASE}/Trophy/3D/trophy_3d.png`,
  '🎯': `${STATIC_3D_BASE}/Bullseye/3D/bullseye_3d.png`,
  '💡': `${STATIC_3D_BASE}/Light%20bulb/3D/light_bulb_3d.png`,
  '⚡': `${STATIC_3D_BASE}/High%20voltage/3D/high_voltage_3d.png`,
  '👑': `${STATIC_3D_BASE}/Crown/3D/crown_3d.png`,
  '☕': `${STATIC_3D_BASE}/Hot%20beverage/3D/hot_beverage_3d.png`,
  '🍕': `${STATIC_3D_BASE}/Pizza/3D/pizza_3d.png`,
  '🍔': `${STATIC_3D_BASE}/Hamburger/3D/hamburger_3d.png`,
  '🍻': `${STATIC_3D_BASE}/Clinking%20beer%20mugs/3D/clinking_beer_mugs_3d.png`,
  '🍺': `${STATIC_3D_BASE}/Beer%20mug/3D/beer_mug_3d.png`,
  '🥂': `${STATIC_3D_BASE}/Clinking%20glasses/3D/clinking_glasses_3d.png`,
  '🎁': `${STATIC_3D_BASE}/Wrapped%20gift/3D/wrapped_gift_3d.png`,
  '🎈': `${STATIC_3D_BASE}/Balloon/3D/balloon_3d.png`,
};

/**
 * Returns the Microsoft Fluent 3D Emoji URL for a given unicode emoji.
 * If { animated: true } is specified, returns the animated 3D APNG if available.
 */
export function getFluentEmojiUrl(
  emoji: string,
  options?: { animated?: boolean }
): string | null {
  if (!emoji) return null;

  if (options?.animated) {
    if (ANIMATED_FLUENT_EMOJI_MAP[emoji]) return ANIMATED_FLUENT_EMOJI_MAP[emoji];
    const stripped = emoji.replace(/[\uFE0E\uFE0F]/g, '');
    if (ANIMATED_FLUENT_EMOJI_MAP[stripped]) return ANIMATED_FLUENT_EMOJI_MAP[stripped];
  }

  // Direct match in 3D map
  if (FLUENT_EMOJI_MAP[emoji]) return FLUENT_EMOJI_MAP[emoji];

  // Try matching without variation selector (e.g. \uFE0E / \uFE0F)
  const stripped = emoji.replace(/[\uFE0E\uFE0F]/g, '');
  if (FLUENT_EMOJI_MAP[stripped]) return FLUENT_EMOJI_MAP[stripped];

  return null;
}

/**
 * Returns the animated 3D Fluent emoji URL (falling back to static 3D).
 */
export function getAnimatedFluentEmojiUrl(emoji: string): string | null {
  return getFluentEmojiUrl(emoji, { animated: true });
}

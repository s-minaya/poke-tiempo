import type { OakPose } from '../oak-pose.ts'
import { POSE_SOURCES } from '../oak-pose.ts'

import './OakPortrait.scss'

interface OakPortraitProps {
  pose: OakPose
}

/**
 * Oak de cintura para arriba. La pose es decorativa respecto al texto —lo
 * que Oak dice ya está en la caja—, así que la imagen no tiene texto
 * alternativo propio: la escena entera ya se anuncia como "Profesor Oak".
 */
function OakPortrait({ pose }: OakPortraitProps) {
  return (
    <div className="oak-portrait">
      <img className="oak-portrait__image" src={POSE_SOURCES[pose]} alt="" draggable={false} />
    </div>
  )
}

export default OakPortrait

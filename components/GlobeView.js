'use client'

import { useRef, useEffect, useState } from 'react'
import Globe from 'react-globe.gl'

export default function GlobeView({ points = [], onPointClick }) {
  const globeEl = useRef()
  const wrapRef = useRef()
  const [width, setWidth] = useState(700)

  useEffect(() => {
    function resize() {
      if (wrapRef.current) setWidth(wrapRef.current.clientWidth)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.5
      controls.enableZoom = true
      globeEl.current.pointOfView({ altitude: 2.3 })
    }
  }, [])

  return (
    <div ref={wrapRef} className="w-full flex justify-center">
      <Globe
        ref={globeEl}
        width={width}
        height={480}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        atmosphereColor="#a78bfa"
        atmosphereAltitude={0.18}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => d.color}
        pointRadius={(d) => d.r}
        pointAltitude={(d) => d.alt}
        pointLabel={(d) => d.label}
        pointsMerge={false}
        onPointClick={onPointClick}
      />
    </div>
  )
}

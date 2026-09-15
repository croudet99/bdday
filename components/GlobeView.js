'use client'

import { useRef, useEffect, useState } from 'react'
import Globe from 'react-globe.gl'

export default function GlobeView({ points = [], onPointClick }) {
  const globeEl = useRef()
  const wrapRef = useRef()
  const [width, setWidth] = useState(700)
  const [height, setHeight] = useState(480)

  useEffect(() => {
    function resize() {
      if (wrapRef.current) {
        const w = wrapRef.current.clientWidth
        setWidth(w)
        setHeight(w < 500 ? 380 : 480)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.45
      controls.enableZoom = true
      controls.zoomSpeed = 0.6
      globeEl.current.pointOfView({ altitude: 2.3 })
    }
  }, [])

  return (
    <div ref={wrapRef} className="w-full flex justify-center">
      <Globe
        ref={globeEl}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        atmosphereColor="#5EEAD4"
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

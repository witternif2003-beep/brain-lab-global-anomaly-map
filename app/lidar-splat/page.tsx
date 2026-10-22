'use client';

import dynamic from 'next/dynamic';

const LidarSplatViewer = dynamic(() => import('../../components/LidarSplatViewer'), { ssr: false });

export default function LidarSplatPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 pt-6 font-mono sm:px-6 lg:px-8">
      <h1 className="text-lg text-cyan-300">LiDAR Gaussian splats · WebGPU / WebGL2 · WebXR</h1>
      <LidarSplatViewer />
    </div>
  );
}

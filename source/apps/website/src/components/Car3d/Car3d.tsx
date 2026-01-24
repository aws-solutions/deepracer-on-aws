// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarColor, CarShell } from '@deepracer-indy/typescript-client';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { lazy, Suspense } from 'react';

import './styles.css';

interface Car3dProps {
  selectedShellColor: CarColor;
  selectedShellType: CarShell;
}

const Car3d = ({ selectedShellColor, selectedShellType }: Car3dProps) => {
  const completeShellString =
    selectedShellType === CarShell.DEEPRACER ? selectedShellType : `${selectedShellType}_${selectedShellColor}`;

  const Model3d = lazy(() => import('./components/ModelLoader'));

  return (
    <Canvas camera={{ near: 1, position: [2.25, 1, 1.5], zoom: 10 }} className="car3d">
      <ambientLight intensity={1.5} />
      <pointLight intensity={5} position={[0.5, 1, 1]} />
      <spotLight intensity={2} position={[0.5, 1, 1]} />
      <OrbitControls
        enablePan={false}
        maxDistance={20}
        maxPolarAngle={Math.PI * 0.5}
        minDistance={2}
        target={[0, 0.1, 0]}
      />
      <Suspense>
        <Model3d completeShellName={completeShellString} bodyColor={selectedShellColor} />
      </Suspense>
    </Canvas>
  );
};

export default Car3d;

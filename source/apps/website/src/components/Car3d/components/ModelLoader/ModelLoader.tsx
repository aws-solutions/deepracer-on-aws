// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarColor, CarShell } from '@deepracer-indy/typescript-client';
import { useGLTF } from '@react-three/drei';
import { Mesh, MeshStandardMaterial } from 'three';
import { GLTF } from 'three-stdlib';

import { ShellColorHexValue } from '#constants/carShell';

interface ModelLoaderProps {
  completeShellName: string;
  bodyColor: CarColor;
}

type gltfType = GLTF & {
  nodes: Record<string, Mesh>;
  materials: Record<string, MeshStandardMaterial>;
};

const ModelLoader = ({ completeShellName, bodyColor }: ModelLoaderProps) => {
  const { scene, nodes, materials } = useGLTF(`/models/carShells/${completeShellName}.glb`) as gltfType;
  if (completeShellName === CarShell.DEEPRACER) {
    const wheelColor = bodyColor === CarColor.BLACK ? ShellColorHexValue.GREY : ShellColorHexValue.BLACK;

    // if shell is EVO shell, color has to be manually changed, so it must be returned like this.
    // for any other shell, return is outside if condition.
    return (
      <group dispose={null} position={[-0.1, 0, 0]}>
        <mesh material={materials.lambert1} geometry={nodes.car_body.geometry} scale={[0.01, 0.01, 0.01]}>
          <meshStandardMaterial attach="material" color={ShellColorHexValue[bodyColor]} />
        </mesh>
        <mesh material={materials.lambert1} geometry={nodes.wheel_fr.geometry} scale={[0.01, 0.01, 0.01]}>
          <meshStandardMaterial attach="material" color={wheelColor} />
        </mesh>
        <mesh material={materials.lambert1} geometry={nodes.wheel_fl.geometry} scale={[0.01, 0.01, 0.01]}>
          <meshStandardMaterial attach="material" color={wheelColor} />
        </mesh>
        <mesh material={materials.lambert1} geometry={nodes.wheel_rl.geometry} scale={[0.01, 0.01, 0.01]}>
          <meshStandardMaterial attach="material" color={wheelColor} />
        </mesh>
        <mesh material={materials.lambert1} geometry={nodes.wheel_rr.geometry} scale={[0.01, 0.01, 0.01]}>
          <meshStandardMaterial attach="material" color={wheelColor} />
        </mesh>
      </group>
    );
  }
  return <primitive object={scene} />;
};

export default ModelLoader;

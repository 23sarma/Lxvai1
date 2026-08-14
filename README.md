# AetherQ Simulator

High-performance TypeScript simulation library for quantum algorithms, statevector operations, and variational calculations.

## Quick Start

typescript
import {
  QuantumCircuit,
  QuantumEngine,
  GroverAlgorithm,
  DeutschJozsaAlgorithm,
  VQESolver
} from './src/autonomous_modules/quantum_algorithm_simulators_2973';

// 1. Run Grover's Algorithm
const result = GroverAlgorithm.search(3, 5);
console.log(`Detected Index: ${result.detectedIndex} with probability ${result.successProbability.toFixed(4)}`);

// 2. Solve Variational Quantum Eigensolver for H2 Molecular Analogue
const h2Hamiltonian = [
  { coefficient: -1.0523, paulis: {} },
  { coefficient: 0.3979, paulis: { 0: 'Z' } },
  { coefficient: -0.3979, paulis: { 1: 'Z' } },
  { coefficient: -0.0112, paulis: { 0: 'Z', 1: 'Z' } },
  { coefficient: 0.1809, paulis: { 0: 'X', 1: 'X' } }
];

const vqeResult = VQESolver.optimize(h2Hamiltonian as any, 2);
console.log(`Computed Ground State Energy: ${vqeResult.groundStateEnergy.toFixed(6)} Hartree`);


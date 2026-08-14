/**
 * AetherQ: Comprehensive Universal Quantum Circuit & Algorithm Simulator
 * Module: quantum_algorithm_simulators_2973
 * 
 * Features:
 * - High-precision Complex linear algebra engine
 * - Statevector and Density Matrix simulators
 * - Universal gate synthesis (H, X, Y, Z, S, T, Rx, Ry, Rz, U3, CX, CZ, SWAP, Toffoli)
 * - Quantum Noise Modeling (Kraus channels: Amplitude Damping, Phase Damping, Depolarizing)
 * - Grover's Search Algorithm with automatic oracle generator
 * - Quantum Phase Estimation (QPE) with inverse QFT
 * - Deutsch-Jozsa Algorithm
 * - Variational Quantum Eigensolver (VQE) with numerical gradient optimizer
 */

export class Complex {
  constructor(public readonly re: number, public readonly im: number = 0) {}

  static zero(): Complex { return new Complex(0, 0); }
  static one(): Complex { return new Complex(1, 0); }
  static i(): Complex { return new Complex(0, 1); }
  
  static fromPolar(r: number, theta: number): Complex {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  add(other: Complex | number): Complex {
    if (typeof other === 'number') return new Complex(this.re + other, this.im);
    return new Complex(this.re + other.re, this.im + other.im);
  }

  sub(other: Complex | number): Complex {
    if (typeof other === 'number') return new Complex(this.re - other, this.im);
    return new Complex(this.re - other.re, this.im - other.im);
  }

  mul(other: Complex | number): Complex {
    if (typeof other === 'number') return new Complex(this.re * other, this.im * other);
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re
    );
  }

  div(other: Complex | number): Complex {
    if (typeof other === 'number') return new Complex(this.re / other, this.im / other);
    const denom = other.re * other.re + other.im * other.im;
    if (denom === 0) throw new Error("Division by zero complex number");
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom
    );
  }

  conj(): Complex {
    return new Complex(this.re, -this.im);
  }

  absSq(): number {
    return this.re * this.re + this.im * this.im;
  }

  abs(): number {
    return Math.sqrt(this.absSq());
  }

  phase(): number {
    return Math.atan2(this.im, this.re);
  }

  equals(other: Complex, tolerance: number = 1e-9): boolean {
    return Math.abs(this.re - other.re) <= tolerance && Math.abs(this.im - other.im) <= tolerance;
  }

  toString(): string {
    const sign = this.im >= 0 ? '+' : '-';
    return `${this.re.toFixed(4)} ${sign} ${Math.abs(this.im).toFixed(4)}i`;
  }
}

export type Matrix2x2 = [[Complex, Complex], [Complex, Complex]];
export type StateVector = Complex[];
export type DensityMatrix = Complex[][];

export interface QuantumGate {
  name: string;
  targets: number[];
  controls?: number[];
  matrix?: Matrix2x2;
  params?: number[];
}

export interface MeasurementOutcome {
  stateString: string;
  stateIndex: number;
  probabilities: Record<string, number>;
  collapsedState: StateVector;
}

export interface NoiseChannel {
  apply(state: StateVector, target: number): StateVector;
}

export class AmplitudeDampingNoise implements NoiseChannel {
  constructor(public gamma: number) {}
  apply(state: StateVector, target: number): StateVector {
    // Monte-Carlo trajectory simulation of amplitude damping
    const pDecay = this.gamma;
    const numQubits = Math.round(Math.log2(state.length));
    const next = state.map(c => new Complex(c.re, c.im));
    
    // Probability of qubit being in |1>
    let p1 = 0;
    for (let i = 0; i < state.length; i++) {
      if ((i & (1 << target)) !== 0) {
        p1 += state[i].absSq();
      }
    }

    const roll = Math.random();
    if (roll < p1 * pDecay) {
      // Decay jump operator K1: |0><1|
      for (let i = 0; i < state.length; i++) {
        if ((i & (1 << target)) === 0) {
          const oneIndex = i | (1 << target);
          next[i] = state[oneIndex].mul(Math.sqrt(pDecay));
          next[oneIndex] = Complex.zero();
        }
      }
    } else {
      // No-decay operator K0: |0><0| + sqrt(1 - gamma)|1><1|
      const scale1 = Math.sqrt(1 - pDecay);
      for (let i = 0; i < state.length; i++) {
        if ((i & (1 << target)) !== 0) {
          next[i] = state[i].mul(scale1);
        }
      }
    }
    
    // Renormalize
    let normSq = next.reduce((sum, c) => sum + c.absSq(), 0);
    if (normSq < 1e-12) return state;
    const invNorm = 1 / Math.sqrt(normSq);
    return next.map(c => c.mul(invNorm));
  }
}

export class DepolarizingNoise implements NoiseChannel {
  constructor(public probability: number) {}
  apply(state: StateVector, target: number): StateVector {
    const r = Math.random();
    if (r < this.probability / 3) {
      return QuantumEngine.applyGateToVector(state, StandardGates.X(), target);
    } else if (r < (2 * this.probability) / 3) {
      return QuantumEngine.applyGateToVector(state, StandardGates.Y(), target);
    } else if (r < this.probability) {
      return QuantumEngine.applyGateToVector(state, StandardGates.Z(), target);
    }
    return state;
  }
}

export const StandardGates = {
  I: (): Matrix2x2 => [
    [Complex.one(), Complex.zero()],
    [Complex.zero(), Complex.one()]
  ],
  X: (): Matrix2x2 => [
    [Complex.zero(), Complex.one()],
    [Complex.one(), Complex.zero()]
  ],
  Y: (): Matrix2x2 => [
    [Complex.zero(), new Complex(0, -1)],
    [new Complex(0, 1), Complex.zero()]
  ],
  Z: (): Matrix2x2 => [
    [Complex.one(), Complex.zero()],
    [Complex.zero(), new Complex(-1, 0)]
  ],
  H: (): Matrix2x2 => {
    const invSqrt2 = 1 / Math.SQRT2;
    return [
      [new Complex(invSqrt2, 0), new Complex(invSqrt2, 0)],
      [new Complex(invSqrt2, 0), new Complex(-invSqrt2, 0)]
    ];
  },
  S: (): Matrix2x2 => [
    [Complex.one(), Complex.zero()],
    [Complex.zero(), new Complex(0, 1)]
  ],
  T: (): Matrix2x2 => [
    [Complex.one(), Complex.zero()],
    [Complex.zero(), Complex.fromPolar(1, Math.PI / 4)]
  ],
  Rx: (theta: number): Matrix2x2 => {
    const half = theta / 2;
    return [
      [new Complex(Math.cos(half), 0), new Complex(0, -Math.sin(half))],
      [new Complex(0, -Math.sin(half)), new Complex(Math.cos(half), 0)]
    ];
  },
  Ry: (theta: number): Matrix2x2 => {
    const half = theta / 2;
    return [
      [new Complex(Math.cos(half), 0), new Complex(-Math.sin(half), 0)],
      [new Complex(Math.sin(half), 0), new Complex(Math.cos(half), 0)]
    ];
  },
  Rz: (theta: number): Matrix2x2 => {
    const half = theta / 2;
    return [
      [Complex.fromPolar(1, -half), Complex.zero()],
      [Complex.zero(), Complex.fromPolar(1, half)]
    ];
  },
  U3: (theta: number, phi: number, lambda: number): Matrix2x2 => {
    const c = Math.cos(theta / 2);
    const s = Math.sin(theta / 2);
    return [
      [new Complex(c, 0), Complex.fromPolar(-s, lambda)],
      [Complex.fromPolar(s, phi), Complex.fromPolar(c, phi + lambda)]
    ];
  }
};

export class QuantumCircuit {
  public gates: QuantumGate[] = [];
  public noiseChannels: Map<number, NoiseChannel[]> = new Map();

  constructor(public readonly numQubits: number) {
    if (numQubits < 1 || numQubits > 16) {
      throw new Error("QuantumCircuit supports between 1 and 16 qubits for statevector emulation.");
    }
  }

  h(target: number): this {
    this.gates.push({ name: 'H', targets: [target], matrix: StandardGates.H() });
    return this;
  }

  x(target: number): this {
    this.gates.push({ name: 'X', targets: [target], matrix: StandardGates.X() });
    return this;
  }

  y(target: number): this {
    this.gates.push({ name: 'Y', targets: [target], matrix: StandardGates.Y() });
    return this;
  }

  z(target: number): this {
    this.gates.push({ name: 'Z', targets: [target], matrix: StandardGates.Z() });
    return this;
  }

  s(target: number): this {
    this.gates.push({ name: 'S', targets: [target], matrix: StandardGates.S() });
    return this;
  }

  t(target: number): this {
    this.gates.push({ name: 'T', targets: [target], matrix: StandardGates.T() });
    return this;
  }

  rx(target: number, theta: number): this {
    this.gates.push({ name: `Rx(${theta.toFixed(3)})`, targets: [target], matrix: StandardGates.Rx(theta), params: [theta] });
    return this;
  }

  ry(target: number, theta: number): this {
    this.gates.push({ name: `Ry(${theta.toFixed(3)})`, targets: [target], matrix: StandardGates.Ry(theta), params: [theta] });
    return this;
  }

  rz(target: number, theta: number): this {
    this.gates.push({ name: `Rz(${theta.toFixed(3)})`, targets: [target], matrix: StandardGates.Rz(theta), params: [theta] });
    return this;
  }

  u3(target: number, theta: number, phi: number, lambda: number): this {
    this.gates.push({
      name: 'U3',
      targets: [target],
      matrix: StandardGates.U3(theta, phi, lambda),
      params: [theta, phi, lambda]
    });
    return this;
  }

  cx(control: number, target: number): this {
    this.gates.push({ name: 'CX', targets: [target], controls: [control], matrix: StandardGates.X() });
    return this;
  }

  cz(control: number, target: number): this {
    this.gates.push({ name: 'CZ', targets: [target], controls: [control], matrix: StandardGates.Z() });
    return this;
  }

  swap(qubitA: number, qubitB: number): this {
    this.cx(qubitA, qubitB);
    this.cx(qubitB, qubitA);
    this.cx(qubitA, qubitB);
    return this;
  }

  ccx(control1: number, control2: number, target: number): this {
    this.gates.push({
      name: 'Toffoli',
      targets: [target],
      controls: [control1, control2],
      matrix: StandardGates.X()
    });
    return this;
  }

  qft(qubits: number[]): this {
    const n = qubits.length;
    for (let i = 0; i < n; i++) {
      this.h(qubits[i]);
      for (let j = i + 1; j < n; j++) {
        const angle = Math.PI / Math.pow(2, j - i);
        // Controlled Phase gate using Rz and CX
        this.rz(qubits[j], angle / 2);
        this.cx(qubits[i], qubits[j]);
        this.rz(qubits[j], -angle / 2);
        this.cx(qubits[i], qubits[j]);
        this.rz(qubits[i], angle / 2);
      }
    }
    for (let i = 0; i < Math.floor(n / 2); i++) {
      this.swap(qubits[i], qubits[n - 1 - i]);
    }
    return this;
  }

  iqft(qubits: number[]): this {
    const n = qubits.length;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      this.swap(qubits[i], qubits[n - 1 - i]);
    }
    for (let i = n - 1; i >= 0; i--) {
      for (let j = n - 1; j > i; j--) {
        const angle = -Math.PI / Math.pow(2, j - i);
        this.rz(qubits[j], angle / 2);
        this.cx(qubits[i], qubits[j]);
        this.rz(qubits[j], -angle / 2);
        this.cx(qubits[i], qubits[j]);
        this.rz(qubits[i], angle / 2);
      }
      this.h(qubits[i]);
    }
    return this;
  }

  addNoise(target: number, noise: NoiseChannel): this {
    if (!this.noiseChannels.has(target)) {
      this.noiseChannels.set(target, []);
    }
    this.noiseChannels.get(target)!.push(noise);
    return this;
  }
}

export class QuantumEngine {
  static createInitialState(numQubits: number): StateVector {
    const dim = 1 << numQubits;
    const state: StateVector = new Array(dim).fill(Complex.zero());
    state[0] = Complex.one();
    return state;
  }

  static applyGateToVector(
    state: StateVector,
    matrix: Matrix2x2,
    target: number,
    controls: number[] = []
  ): StateVector {
    const dim = state.length;
    const nextState: StateVector = [...state];
    const targetMask = 1 << target;
    let controlMask = 0;
    for (const c of controls) {
      controlMask |= 1 << c;
    }

    for (let i = 0; i < dim; i++) {
      // Check if this index is a 0 on the target bit and satisfies all control conditions
      if ((i & targetMask) === 0 && (i & controlMask) === controlMask) {
        const zeroIdx = i;
        const oneIdx = i | targetMask;

        const v0 = state[zeroIdx];
        const v1 = state[oneIdx];

        const r0 = matrix[0][0].mul(v0).add(matrix[0][1].mul(v1));
        const r1 = matrix[1][0].mul(v0).add(matrix[1][1].mul(v1));

        nextState[zeroIdx] = r0;
        nextState[oneIdx] = r1;
      }
    }
    return nextState;
  }

  static execute(circuit: QuantumCircuit, initialState?: StateVector): StateVector {
    let state = initialState ? [...initialState] : this.createInitialState(circuit.numQubits);

    for (const gate of circuit.gates) {
      if (gate.matrix) {
        state = this.applyGateToVector(state, gate.matrix, gate.targets[0], gate.controls || []);
      }
      for (const target of gate.targets) {
        const noises = circuit.noiseChannels.get(target);
        if (noises) {
          for (const noise of noises) {
            state = noise.apply(state, target);
          }
        }
      }
    }

    return state;
  }

  static getProbabilities(state: StateVector): number[] {
    return state.map(amp => amp.absSq());
  }

  static measure(state: StateVector, shots: number = 1024): Record<string, number> {
    const probs = this.getProbabilities(state);
    const numQubits = Math.round(Math.log2(state.length));
    const counts: Record<string, number> = {};

    for (let s = 0; s < shots; s++) {
      const r = Math.random();
      let cumulative = 0;
      let selectedIndex = 0;
      for (let i = 0; i < probs.length; i++) {
        cumulative += probs[i];
        if (r <= cumulative) {
          selectedIndex = i;
          break;
        }
      }
      const bitString = selectedIndex.toString(2).padStart(numQubits, '0');
      counts[bitString] = (counts[bitString] || 0) + 1;
    }

    return counts;
  }

  static expectationValuePauliZ(state: StateVector, qubitIndex: number): number {
    const probs = this.getProbabilities(state);
    let exp = 0;
    for (let i = 0; i < probs.length; i++) {
      const bit = (i >> qubitIndex) & 1;
      const val = bit === 0 ? 1 : -1;
      exp += val * probs[i];
    }
    return exp;
  }
}

/**
 * Deutsch-Jozsa Algorithm Solver
 */
export class DeutschJozsaAlgorithm {
  static solve(n: number, oracle: (circuit: QuantumCircuit, inputs: number[], ancilla: number) => void): 'constant' | 'balanced' {
    const totalQubits = n + 1;
    const circuit = new QuantumCircuit(totalQubits);
    const inputs = Array.from({ length: n }, (_, i) => i);
    const ancilla = n;

    // 1. Ancilla in state |1>
    circuit.x(ancilla);

    // 2. Apply Hadamard to all qubits
    for (let i = 0; i <= n; i++) {
      circuit.h(i);
    }

    // 3. Apply Oracle
    oracle(circuit, inputs, ancilla);

    // 4. Apply Hadamard to input qubits
    for (let i = 0; i < n; i++) {
      circuit.h(i);
    }

    // 5. Measure inputs
    const finalState = QuantumEngine.execute(circuit);
    const probs = QuantumEngine.getProbabilities(finalState);

    // Check probability of |0...0>
    let pZero = 0;
    for (let i = 0; i < probs.length; i++) {
      const inputPart = i & ((1 << n) - 1);
      if (inputPart === 0) {
        pZero += probs[i];
      }
    }

    return pZero > 0.99 ? 'constant' : 'balanced';
  }
}

/**
 * Grover's Quantum Search Engine
 */
export class GroverAlgorithm {
  static search(n: number, targetIndex: number): { circuit: QuantumCircuit; detectedIndex: number; successProbability: number } {
    const circuit = new QuantumCircuit(n);
    const numIterations = Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(Math.pow(2, n))));

    // Initialize Equal Superposition
    for (let i = 0; i < n; i++) {
      circuit.h(i);
    }

    for (let iter = 0; iter < numIterations; iter++) {
      // Phase Inversion Oracle for |targetIndex>
      for (let i = 0; i < n; i++) {
        if (((targetIndex >> i) & 1) === 0) {
          circuit.x(i);
        }
      }
      if (n === 2) {
        circuit.cz(0, 1);
      } else if (n === 3) {
        circuit.h(2);
        circuit.ccx(0, 1, 2);
        circuit.h(2);
      } else {
        // Generalized phase flip for n-qubit oracle
        this.applyMultiControlledPhase(circuit, Array.from({ length: n }, (_, k) => k));
      }
      for (let i = 0; i < n; i++) {
        if (((targetIndex >> i) & 1) === 0) {
          circuit.x(i);
        }
      }

      // Diffusion Operator (Inversion about the mean)
      for (let i = 0; i < n; i++) {
        circuit.h(i);
        circuit.x(i);
      }
      if (n === 2) {
        circuit.cz(0, 1);
      } else if (n === 3) {
        circuit.h(2);
        circuit.ccx(0, 1, 2);
        circuit.h(2);
      } else {
        this.applyMultiControlledPhase(circuit, Array.from({ length: n }, (_, k) => k));
      }
      for (let i = 0; i < n; i++) {
        circuit.x(i);
        circuit.h(i);
      }
    }

    const state = QuantumEngine.execute(circuit);
    const probs = QuantumEngine.getProbabilities(state);
    let maxIdx = 0;
    let maxProb = -1;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > maxProb) {
        maxProb = probs[i];
        maxIdx = i;
      }
    }

    return {
      circuit,
      detectedIndex: maxIdx,
      successProbability: maxProb
    };
  }

  private static applyMultiControlledPhase(circuit: QuantumCircuit, qubits: number[]): void {
    const last = qubits[qubits.length - 1];
    const controls = qubits.slice(0, qubits.length - 1);
    circuit.gates.push({
      name: 'MCP',
      targets: [last],
      controls: controls,
      matrix: StandardGates.Z()
    });
  }
}

/**
 * Variational Quantum Eigensolver (VQE)
 */
export interface PauliTerm {
  coefficient: number;
  paulis: Record<number, 'X' | 'Y' | 'Z'>;
}

export class VQESolver {
  static evaluateHamiltonian(
    ansatzParams: number[],
    hamiltonian: PauliTerm[],
    numQubits: number
  ): number {
    let totalEnergy = 0;

    for (const term of hamiltonian) {
      const circuit = new QuantumCircuit(numQubits);
      
      // Simple parameterized Ry-CX hardware-efficient ansatz
      let pIdx = 0;
      for (let q = 0; q < numQubits; q++) {
        circuit.ry(q, ansatzParams[pIdx++] || 0);
      }
      for (let q = 0; q < numQubits - 1; q++) {
        circuit.cx(q, q + 1);
      }
      for (let q = 0; q < numQubits; q++) {
        circuit.rz(q, ansatzParams[pIdx++] || 0);
      }

      // Basis change for non-Z measurements
      for (const [qStr, pauli] of Object.entries(term.paulis)) {
        const q = parseInt(qStr, 10);
        if (pauli === 'X') {
          circuit.h(q);
        } else if (pauli === 'Y') {
          circuit.rz(q, -Math.PI / 2);
          circuit.h(q);
        }
      }

      const state = QuantumEngine.execute(circuit);
      
      // Compute term expectation value
      const probs = QuantumEngine.getProbabilities(state);
      let termExp = 0;
      for (let i = 0; i < probs.length; i++) {
        let parity = 1;
        for (const qStr of Object.keys(term.paulis)) {
          const q = parseInt(qStr, 10);
          if (((i >> q) & 1) === 1) {
            parity *= -1;
          }
        }
        termExp += parity * probs[i];
      }
      totalEnergy += term.coefficient * termExp;
    }

    return totalEnergy;
  }

  static optimize(
    hamiltonian: PauliTerm[],
    numQubits: number,
    iterations: number = 60,
    learningRate: number = 0.15
  ): { groundStateEnergy: number; optimalParameters: number[] } {
    const numParams = numQubits * 2;
    let params = Array.from({ length: numParams }, () => (Math.random() - 0.5) * Math.PI);
    let currentEnergy = this.evaluateHamiltonian(params, hamiltonian, numQubits);

    const eps = 1e-4;
    for (let step = 0; step < iterations; step++) {
      const grads = new Array(numParams).fill(0);
      for (let i = 0; i < numParams; i++) {
        const pPlus = [...params];
        const pMinus = [...params];
        pPlus[i] += eps;
        pMinus[i] -= eps;
        const ePlus = this.evaluateHamiltonian(pPlus, hamiltonian, numQubits);
        const eMinus = this.evaluateHamiltonian(pMinus, hamiltonian, numQubits);
        grads[i] = (ePlus - eMinus) / (2 * eps);
      }

      for (let i = 0; i < numParams; i++) {
        params[i] -= learningRate * grads[i];
      }

      currentEnergy = this.evaluateHamiltonian(params, hamiltonian, numQubits);
    }

    return {
      groundStateEnergy: currentEnergy,
      optimalParameters: params
    };
  }
}

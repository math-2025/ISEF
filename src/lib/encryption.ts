
// @ts-nocheck
'use client';

/**
 * A library for performing reversible, multi-step coordinate "encryption".
 * This is for demonstration purposes and uses deterministic, reversible algorithms.
 */

export type DerivationStep = {
  name: string;
  latitude: number;
  longitude: number;
  details: string; // To show the actual math
};

export type EncryptedData = {
  encryptedLat: number;
  encryptedLng: number;
  derivationSteps: DerivationStep[];
};

// --- Helper Functions ---

/**
 * Creates a numeric seed from a string key.
 * This is a simple hashing function.
 */
function createSeed(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * A pseudo-random number generator based on the Lehmer/Park-Miller algorithm.
 * It's deterministic based on the seed.
 */
function lcg(seed: number) {
  return () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
}

// --- Transformation Steps (Reversible) ---
// Each function now returns the new coordinates and the details of the operation

function collatzStep(lat: number, lng: number, seed: number, reverse = false): [number, number, string] {
  let latInt = Math.floor(Math.abs(lat));
  let lngInt = Math.floor(Math.abs(lng));
  let details = `Input: (${lat.toFixed(6)}, ${lng.toFixed(6)})\nInteger Parts: X=${latInt}, Y=${lngInt}\n\n`;
  const iterations = 5; 
  
  let latHistory = [latInt];
  let lngHistory = [lngInt];

  // Forward Collatz
  for(let i=0; i<iterations; i++) {
    details += `Step ${i+1}:\n`;
    let newLatInt, newLngInt;
    
    if (latInt % 2 === 0) {
        newLatInt = latInt / 2;
        details += `  X: ${latInt} (even) -> ${latInt} / 2 = ${newLatInt}\n`;
    } else {
        newLatInt = (latInt * 3) + 1;
        details += `  X: ${latInt} (odd) -> (3 * ${latInt}) + 1 = ${newLatInt}\n`;
    }
    latInt = newLatInt;
    latHistory.push(latInt);

    if (lngInt % 2 === 0) {
        newLngInt = lngInt / 2;
        details += `  Y: ${lngInt} (even) -> ${lngInt} / 2 = ${newLngInt}\n`;
    } else {
        newLngInt = (lngInt * 3) + 1;
        details += `  Y: ${lngInt} (odd) -> (3 * ${lngInt}) + 1 = ${newLngInt}\n`;
    }
    lngInt = newLngInt;
    lngHistory.push(lngInt);
    details += '\n';
  }

  const latOffset = (latHistory.reduce((a, b) => a + b, 0) % 10000) / 100000;
  const lngOffset = (lngHistory.reduce((a, b) => a + b, 0) % 10000) / 100000;
  
  details += `Resulting Offsets:\n  Lat Offset: ΣX % 10000 / 100000 = ${latOffset.toFixed(6)}\n  Lng Offset: ΣY % 10000 / 100000 = ${lngOffset.toFixed(6)}\n`;
  
  const newLat = lat + latOffset;
  const newLng = lng - lngOffset;
  details += `Output: (${newLat.toFixed(6)}, ${newLng.toFixed(6)})`;


  return reverse 
    ? [lat - latOffset, lng + lngOffset, details] 
    : [newLat, newLng, details];
}

function primeJumpStep(lat: number, lng: number, seed: number, reverse = false): [number, number, string] {
  const primes = [17, 31, 53, 71, 97];
  const random = lcg(seed);
  const prime1 = primes[Math.floor(random() * primes.length)];
  const prime2 = primes[Math.floor(random() * primes.length)];
  const offset = (prime1 * prime2) / 100000;
  
  const newLat = lat - offset;
  const newLng = lng + offset;

  const details = `Input: (${lat.toFixed(6)}, ${lng.toFixed(6)})\nChosen Primes: p1=${prime1}, p2=${prime2}\nOffset Calculation: (p1 * p2) / 100000 = ${offset.toFixed(6)}\nNew Lat: lat - offset = ${lat.toFixed(6)} - ${offset.toFixed(6)} = ${newLat.toFixed(6)}\nNew Lng: lng + offset = ${lng.toFixed(6)} + ${offset.toFixed(6)} = ${newLng.toFixed(6)}`;
  
  return reverse 
    ? [lat + offset, lng - offset, details] 
    : [newLat, newLng, details];
}

function fibonacciStep(lat: number, lng: number, seed: number, reverse = false): [number, number, string] {
  const random = lcg(seed);
  const goldenAngle = 137.5 * (Math.PI / 180);
  const distance = random() * 0.02;
  const angle = random() * 360;

  const latOffset = distance * Math.cos(angle * goldenAngle);
  const lngOffset = distance * Math.sin(angle * goldenAngle);
  
  const newLat = lat + latOffset;
  const newLng = lng + lngOffset;

  const details = `Input: (${lat.toFixed(6)}, ${lng.toFixed(6)})\nGolden Angle: ${goldenAngle.toFixed(4)} rad\nDistance (d): ${distance.toFixed(4)}, Angle (a): ${angle.toFixed(4)}\nLat Offset: d * cos(a * GA) = ${latOffset.toFixed(6)}\nLng Offset: d * sin(a * GA) = ${lngOffset.toFixed(6)}\nOutput: (${newLat.toFixed(6)}, ${newLng.toFixed(6)})`;

  return reverse
    ? [lat - latOffset, lng - lngOffset, details]
    : [newLat, newLng, details];
}

function affineTransformationStep(lat: number, lng: number, seed: number, reverse = false): [number, number, string] {
    const random = lcg(seed);
    const a1 = 1 + (random() - 0.5) * 0.2; 
    const b1 = (random() - 0.5) * 0.1;
    const a2 = 1 + (random() - 0.5) * 0.2;
    const b2 = (random() - 0.5) * 0.1;
    
    let details = `Input: (${lat.toFixed(6)}, ${lng.toFixed(6)})\n`;
    details += `Formulas:\n  new_lat = (lat * a1) + b1\n  new_lng = (lng * a2) + b2\n\n`;
    details += `Variables:\n  a1=${a1.toFixed(4)}, b1=${b1.toFixed(4)}\n  a2=${a2.toFixed(4)}, b2=${b2.toFixed(4)}\n\n`;
    
    if (reverse) {
        const decryptedLat = (lat - b1) / a1;
        const decryptedLng = (lng - b2) / a2;
        details += `Reverse Calculation:\n  orig_lat = (${lat.toFixed(6)} - ${b1.toFixed(4)}) / ${a1.toFixed(4)} = ${decryptedLat.toFixed(6)}\n  orig_lng = (${lng.toFixed(6)} - ${b2.toFixed(4)}) / ${a2.toFixed(4)} = ${decryptedLng.toFixed(6)}`;
        return [decryptedLat, decryptedLng, details];
    } else {
        const encryptedLat = a1 * lat + b1;
        const encryptedLng = a2 * lng + b2;
        details += `Forward Calculation:\n  new_lat = (${lat.toFixed(6)} * ${a1.toFixed(4)}) + ${b1.toFixed(4)} = ${encryptedLat.toFixed(6)}\n  new_lng = (${lng.toFixed(6)} * ${a2.toFixed(4)}) + ${b2.toFixed(4)} = ${encryptedLng.toFixed(6)}`;
        return [encryptedLat, encryptedLng, details];
    }
}

function logarithmicSpiralStep(lat: number, lng: number, seed: number, reverse = false): [number, number, string] {
    const random = lcg(seed);
    const a = 0.01 + random() * 0.01;
    const b = 0.1 + random() * 0.1;
    const theta = (random() * 2 - 1) * Math.PI;

    const r = a * Math.exp(b * theta);

    const latOffset = r * Math.cos(theta);
    const lngOffset = r * Math.sin(theta);
    
    const newLat = lat + latOffset;
    const newLng = lng + lngOffset;

    let details = `Input: (${lat.toFixed(6)}, ${lng.toFixed(6)})\n`;
    details += `Formulas:\n  r = a * e^(b * θ)\n  lat_offset = r * cos(θ)\n  lng_offset = r * sin(θ)\n\n`;
    details += `Variables:\n  a=${a.toFixed(4)}, b=${b.toFixed(4)}, θ=${theta.toFixed(4)}\n\n`;
    details += `Calculation:\n  r = ${a.toFixed(4)} * e^(${b.toFixed(4)} * ${theta.toFixed(4)}) = ${r.toFixed(6)}\n  lat_offset = ${r.toFixed(6)} * cos(${theta.toFixed(4)}) = ${latOffset.toFixed(6)}\n  lng_offset = ${r.toFixed(6)} * sin(${theta.toFixed(4)}) = ${lngOffset.toFixed(6)}\n`;
    details += `Output: (${newLat.toFixed(6)}, ${newLng.toFixed(6)})`;

    if (reverse) {
        return [lat - latOffset, lng - lngOffset, details];
    } else {
        return [newLat, newLng, details];
    }
}


// --- Main Encryption/Decryption Functions ---

const steps = [
    { fn: collatzStep, name: 'Collatz Fərziyyəsi ilə Qarışdırma' },
    { fn: primeJumpStep, name: 'Sadə Ədədlə Atlama (Prime-Jump)' },
    { fn: fibonacciStep, name: 'Fibonaççi Spiral Sürüşdürməsi' },
    { fn: affineTransformationStep, name: 'Affin Koordinat Transformasiyası' },
    { fn: logarithmicSpiralStep, name: 'Logarifmik Spiral Yerdəyişməsi' },
];

export function encryptCoordinates(lat: number, lng: number, key: string): EncryptedData {
  let currentLat = lat;
  let currentLng = lng;
  const derivationSteps: DerivationStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const seed = createSeed(key + i); // Use a different seed for each step
    const [newLat, newLng, details] = step.fn(currentLat, currentLng, seed, false);
    
    // The output of this step becomes the input for the next
    currentLat = newLat;
    currentLng = newLng;

    derivationSteps.push({
      name: step.name,
      latitude: currentLat,
      longitude: currentLng,
      details: details,
    });
  }

  return {
    encryptedLat: currentLat,
    encryptedLng: currentLng,
    derivationSteps,
  };
}

export function decryptCoordinates(encryptedLat: number, encryptedLng: number, key: string): { decryptedLat: number, decryptedLng: number } {
  let currentLat = encryptedLat;
  let currentLng = encryptedLng;

  // Apply the steps in reverse order
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    const seed = createSeed(key + i);
    // We only need the coordinates, not the details, for decryption
    const [newLat, newLng] = step.fn(currentLat, currentLng, seed, true);
    currentLat = newLat;
    currentLng = newLng;
  }

  return {
    decryptedLat: currentLat,
    decryptedLng: currentLng,
  };
}


/**
 * Pseudo-encrypts a text message for demonstration and returns the encrypted text and the initial ASCII sum.
 * This is NOT secure.
 */
export function encryptMessage(text: string): { encryptedText: string, asciiSum: number } {
  // 1. Convert text to a number (sum of ASCII values)
  let asciiSum = 0;
  for (let i = 0; i < text.length; i++) {
    asciiSum += text.charCodeAt(i);
  }
  
  // Use the text length as a simple "key"
  const key = text.length.toString();

  // 2. Use the coordinate encryption logic, but on the single numeric value
  let currentValue = asciiSum;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const seed = createSeed(key + i);
    // Apply the step function, using the same value for lat/lng and taking the first result
    const [newValue] = step.fn(currentValue, currentValue, seed, false);
    currentValue = newValue;
  }

  // 3. Format the result to look like an encrypted string
  const finalValue = Math.round(currentValue * 1e6); // make it a large integer
  const hexValue = finalValue.toString(16);
  const base64Value = btoa(hexValue).replace(/=/g, ''); // Basic base64 encoding

  // Combine parts to make it look more complex
  const prefix = "gs_enc_v1"; // GeoShield Encrypted Version 1
  const checksum = (asciiSum % 97).toString(16); // Simple checksum

  const encryptedText = `${prefix}$${checksum}$${base64Value}`;

  return { encryptedText, asciiSum };
}

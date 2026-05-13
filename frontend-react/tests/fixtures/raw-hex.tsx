// This file intentionally contains a raw hex literal to verify ESLint D-2.8 enforcement.
// Expected: eslint reports error on the hex literal below.
// Do NOT fix the hex literal — it is the fixture.
export function BadColorComponent() {
  return <div style={{ color: '#1a2b3c' }}>intentionally bad hex</div>
}

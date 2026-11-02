import { describe, expect, it } from 'vitest';
import { shortenTitle } from './shortenTitle';

describe('shortenTitle', () => {
  it('leaves a short title unchanged', () => {
    expect(shortenTitle('Digital Bath', 28)).toBe('Digital Bath');
  });

  it('cuts a long title and marks the cut', () => {
    expect(
      shortenTitle(
        'If I Ruled the World (Imagine That) [feat. Lauryn Hill]',
        28,
      ),
    ).toBe('If I Ruled the World (Imagin…');
  });
});

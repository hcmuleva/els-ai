export type StandardOption = {
  value: string;
  label: string;
};

/**
 * Sentinel value used to mark a classroom (or other resource) as available to
 * students of any class level. The classroom-service also recognizes this
 * value and returns matching rooms to every student regardless of their own
 * `users.class_level`.
 */
export const ANY_CLASS_VALUE = 'ANY';
export const ANY_CLASS_LABEL = 'Any Class';

export const STANDARD_OPTIONS: StandardOption[] = [
  { value: 'LKG', label: 'LKG' },
  { value: 'UKG', label: 'UKG' },
  { value: '1', label: '1 - First' },
  { value: '2', label: '2 - Second' },
  { value: '3', label: '3 - Third' },
  { value: '4', label: '4 - Fourth' },
  { value: '5', label: '5 - Fifth' },
  { value: '6', label: '6 - Sixth' },
  { value: '7', label: '7 - Seventh' },
  { value: '8', label: '8 - Eighth' },
  { value: '9', label: '9 - Ninth' },
  { value: '10', label: '10 - Tenth' },
  { value: '11', label: '11 - Eleventh' },
  { value: '12', label: '12 - Twelfth' },
];

export const getStandardLabel = (value?: string) => {
  if (!value) return '-';
  if (value === ANY_CLASS_VALUE) return ANY_CLASS_LABEL;
  const option = STANDARD_OPTIONS.find((item) => item.value === value);
  return option ? option.label : value;
};

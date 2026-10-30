import { MetricType } from './observation.service';

/**
 * Identity colour per metric. Hex (not CSS variables) because charts and SVG
 * attributes need concrete colours; mid-tones chosen to read on light and dark
 * backgrounds. Red/amber are left to severity badges so warnings stand out.
 */
export const METRIC_COLORS: Record<MetricType, string> = {
  bp: '#C24D63',
  glucose: '#B7801F',
  spo2: '#3577B5',
  hr: '#2F8A5F',
  pain: '#7A5CB8',
  weight: '#5B6B7D',
};

/** Brand teal; matches --brand in theme/variables.scss. */
export const BRAND_COLOR = '#146C68';

import React from 'react';
import {
  FluentProvider,
  createLightTheme,
  BrandVariants,
  tokens,
  makeStyles
} from '@fluentui/react-components';
import { IdeaInputPanel } from './components/IdeaInputPanel';

// A more colorful brand ramp (roughly "indigo → cyan")
const brand: BrandVariants = {
  10: '#020305',
  20: '#071122',
  30: '#0A1D3A',
  40: '#0B2B56',
  50: '#0B3A73',
  60: '#0A4A91',
  70: '#0A5BB0',
  80: '#1D74D4',
  90: '#3A8FF0',
  100: '#5AA5FF',
  110: '#7AB9FF',
  120: '#99CCFF',
  130: '#B8DEFF',
  140: '#D7EEFF',
  150: '#EFF8FF',
  160: '#F7FBFF'
};

const theme = createLightTheme(brand);
// A couple of extra tweaks for "pop" while staying readable
(theme as any).colorNeutralBackground1 = '#FFFFFF';
(theme as any).colorNeutralBackground2 = '#F7F9FC';
(theme as any).colorNeutralBackground3 = '#EEF4FF';

const useStyles = makeStyles({
  appShell: {
    minHeight: '100vh',
    background:
      'radial-gradient(1200px 600px at 10% 0%, rgba(58, 143, 240, 0.25), transparent 60%),\n' +
      'radial-gradient(900px 500px at 90% 10%, rgba(90, 165, 255, 0.20), transparent 55%),\n' +
      'linear-gradient(180deg, #F7FBFF 0%, #FFFFFF 45%, #F7F9FC 100%)',
    color: tokens.colorNeutralForeground1
  },
  inner: {
    padding: 14
  }
});

export function App() {
  const styles = useStyles();
  return (
    <FluentProvider theme={theme}>
      <div className={styles.appShell}>
        <div className={styles.inner}>
          <IdeaInputPanel />
        </div>
      </div>
    </FluentProvider>
  );
}

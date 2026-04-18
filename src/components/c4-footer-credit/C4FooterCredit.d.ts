import { FC } from 'react';

interface C4FooterCreditProps {
  href?: string;
  label?: string;
  size?: number;
  showText?: boolean;
  openInNewTab?: boolean;
  colorScheme?: 'light' | 'dark' | string;
  initialStage?: 0 | 1;
}

declare const C4FooterCredit: FC<C4FooterCreditProps>;
export default C4FooterCredit;

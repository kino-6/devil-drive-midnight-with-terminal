import type { ComponentProps } from 'react';
import { UtilityPanels } from './UtilityPanels';
import { GaragePanel } from './GaragePanel';
import { EventPanels } from './EventPanels';

type SystemEventPanelProps = {
  phaseLabel: string;
  stingerLabel: string;
  utilityPanelsProps: ComponentProps<typeof UtilityPanels>;
  garagePanelProps: ComponentProps<typeof GaragePanel>;
  eventPanelsProps: ComponentProps<typeof EventPanels>;
};

export const SystemEventPanel = ({
  phaseLabel,
  stingerLabel,
  utilityPanelsProps,
  garagePanelProps,
  eventPanelsProps,
}: SystemEventPanelProps) => (
  <section className="system-event-panel">
    <div className="encounter-stinger">
      <span>{phaseLabel}</span>
      <strong>{stingerLabel}</strong>
    </div>
    <UtilityPanels {...utilityPanelsProps} />
    <GaragePanel {...garagePanelProps} />
    <EventPanels {...eventPanelsProps} />
  </section>
);


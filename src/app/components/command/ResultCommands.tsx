type ResultCommandsProps = {
  isFunTest?: boolean;
  onStartNextRun: () => void;
  onOpenGarage: () => void;
  onRetry: () => void;
};

export const ResultCommands = ({
  isFunTest = false,
  onStartNextRun,
  onOpenGarage,
  onRetry,
}: ResultCommandsProps) => (
  <div className="command-window command-list">
    <button className="command-button command-button--route" onClick={onStartNextRun}>{isFunTest ? 'BACK TO GARAGE' : 'START NEXT RUN'}</button>
    <button className="command-button command-button--route" onClick={onOpenGarage}>RETURN TO GARAGE</button>
    <button className="command-button command-button--route" onClick={onRetry}>RETRY</button>
  </div>
);

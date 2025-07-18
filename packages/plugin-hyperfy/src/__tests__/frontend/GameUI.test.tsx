import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameUI } from '../../components/GameUI';
import { GameProvider } from '../../contexts/GameContext';
import { PlayerRole } from '../../apps/amongus/GameState';

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

global.WebSocket = jest.fn(() => mockWebSocket) as any;

describe('GameUI Component', () => {
  const defaultProps = {
    playerId: 'test-player',
    playerName: 'Test Player',
    gameId: 'game-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Display', () => {
    it('should display crewmate role correctly', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.CREWMATE}
          />
        </GameProvider>
      );

      const roleElement = screen.getByText('Crewmate');
      expect(roleElement).toBeInTheDocument();
      expect(roleElement).toHaveClass('text-green-500');
    });

    it('should display impostor role correctly', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.IMPOSTOR}
          />
        </GameProvider>
      );

      const roleElement = screen.getByText('Impostor');
      expect(roleElement).toBeInTheDocument();
      expect(roleElement).toHaveClass('text-red-500');
    });

    it('should hide role during meetings', () => {
      const { rerender } = render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.IMPOSTOR}
            gamePhase="playing"
          />
        </GameProvider>
      );

      expect(screen.getByText('Impostor')).toBeInTheDocument();

      rerender(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.IMPOSTOR}
            gamePhase="meeting"
          />
        </GameProvider>
      );

      expect(screen.queryByText('Impostor')).not.toBeInTheDocument();
    });
  });

  describe('Task List', () => {
    const mockTasks = [
      { id: 't1', name: 'Fix Wiring', completed: false, location: 'Electrical' },
      { id: 't2', name: 'Download Data', completed: true, location: 'Admin' },
      { id: 't3', name: 'Submit Scan', completed: false, location: 'MedBay' }
    ];

    it('should display task list for crewmates', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.CREWMATE}
            tasks={mockTasks}
          />
        </GameProvider>
      );

      expect(screen.getByText('Tasks (1/3)')).toBeInTheDocument();
      expect(screen.getByText('Fix Wiring')).toBeInTheDocument();
      expect(screen.getByText('Download Data')).toHaveClass('line-through');
    });

    it('should not display tasks for impostors', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.IMPOSTOR}
            tasks={mockTasks}
          />
        </GameProvider>
      );

      expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
    });

    it('should highlight nearest task', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.CREWMATE}
            tasks={mockTasks}
            nearestTask="t1"
          />
        </GameProvider>
      );

      const wiring = screen.getByText('Fix Wiring');
      expect(wiring.parentElement).toHaveClass('bg-yellow-100');
    });
  });

  describe('Action Buttons', () => {
    it('should show kill button for impostor when near victim', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.IMPOSTOR}
            canKill={true}
            nearbyPlayers={['player-2']}
          />
        </GameProvider>
      );

      const killButton = screen.getByRole('button', { name: /kill/i });
      expect(killButton).toBeInTheDocument();
      expect(killButton).not.toBeDisabled();
    });

    it('should disable kill button on cooldown', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.IMPOSTOR}
            canKill={false}
            killCooldown={15}
            nearbyPlayers={['player-2']}
          />
        </GameProvider>
      );

      const killButton = screen.getByRole('button', { name: /kill/i });
      expect(killButton).toBeDisabled();
      expect(screen.getByText('15s')).toBeInTheDocument();
    });

    it('should show report button when near body', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.CREWMATE}
            nearbyBodies={['body-1']}
          />
        </GameProvider>
      );

      const reportButton = screen.getByRole('button', { name: /report/i });
      expect(reportButton).toBeInTheDocument();
    });

    it('should show emergency button in cafeteria', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.CREWMATE}
            currentLocation="cafeteria"
            emergencyAvailable={true}
          />
        </GameProvider>
      );

      const emergencyButton = screen.getByRole('button', { name: /emergency/i });
      expect(emergencyButton).toBeInTheDocument();
    });
  });

  describe('Meeting UI', () => {
    const mockPlayers = [
      { id: 'p1', name: 'Player 1', alive: true, color: 'red' },
      { id: 'p2', name: 'Player 2', alive: true, color: 'blue' },
      { id: 'p3', name: 'Player 3', alive: false, color: 'green' },
      { id: 'test-player', name: 'Test Player', alive: true, color: 'yellow' }
    ];

    it('should display meeting panel during meetings', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="meeting"
            meetingType="emergency"
            players={mockPlayers}
          />
        </GameProvider>
      );

      expect(screen.getByText('Emergency Meeting')).toBeInTheDocument();
      expect(screen.getByText('Discussion Phase')).toBeInTheDocument();
    });

    it('should show discussion timer', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="meeting"
            discussionTime={25}
            players={mockPlayers}
          />
        </GameProvider>
      );

      expect(screen.getByText('25s')).toBeInTheDocument();
    });

    it('should enable voting after discussion', () => {
      const { rerender } = render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="meeting"
            discussionTime={30}
            players={mockPlayers}
          />
        </GameProvider>
      );

      // No vote buttons during discussion
      expect(screen.queryByRole('button', { name: /vote/i })).not.toBeInTheDocument();

      rerender(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="voting"
            players={mockPlayers}
          />
        </GameProvider>
      );

      // Vote buttons appear
      const voteButtons = screen.getAllByRole('button', { name: /vote/i });
      expect(voteButtons).toHaveLength(2); // Only alive players (excluding self)
    });

    it('should not allow voting for dead players', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="voting"
            players={mockPlayers}
          />
        </GameProvider>
      );

      // Dead player should be shown but not voteable
      expect(screen.getByText('Player 3')).toBeInTheDocument();
      expect(screen.getByText('Player 3').parentElement).toHaveClass('opacity-50');
      
      const deadPlayerContainer = screen.getByText('Player 3').closest('[data-testid="player-vote-option"]');
      expect(deadPlayerContainer?.querySelector('button')).not.toBeInTheDocument();
    });

    it('should handle vote selection', async () => {
      const user = userEvent.setup();
      
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="voting"
            players={mockPlayers}
          />
        </GameProvider>
      );

      const voteButton = screen.getByRole('button', { name: /vote player 1/i });
      await user.click(voteButton);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'vote:cast',
          targetId: 'p1'
        })
      );
    });

    it('should show skip vote option', async () => {
      const user = userEvent.setup();
      
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="voting"
            players={mockPlayers}
          />
        </GameProvider>
      );

      const skipButton = screen.getByRole('button', { name: /skip vote/i });
      await user.click(skipButton);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'vote:cast',
          targetId: null
        })
      );
    });
  });

  describe('Chat System', () => {
    it('should display chat messages', () => {
      const messages = [
        { id: 'm1', playerId: 'p1', playerName: 'Player 1', text: 'I saw red vent!', timestamp: Date.now() - 5000 },
        { id: 'm2', playerId: 'p2', playerName: 'Player 2', text: 'I was in electrical', timestamp: Date.now() - 3000 }
      ];

      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            messages={messages}
          />
        </GameProvider>
      );

      expect(screen.getByText('Player 1: I saw red vent!')).toBeInTheDocument();
      expect(screen.getByText('Player 2: I was in electrical')).toBeInTheDocument();
    });

    it('should allow sending messages during meetings', async () => {
      const user = userEvent.setup();
      
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="meeting"
          />
        </GameProvider>
      );

      const input = screen.getByPlaceholderText('Type a message...');
      await user.type(input, 'I think it\'s blue!');
      await user.keyboard('{Enter}');

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'chat:message',
          text: 'I think it\'s blue!'
        })
      );
    });

    it('should disable chat during gameplay', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="playing"
          />
        </GameProvider>
      );

      const input = screen.queryByPlaceholderText('Type a message...');
      expect(input).not.toBeInTheDocument();
    });
  });

  describe('Game Status', () => {
    it('should show game over screen for crewmate win', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="ended"
            winner="crewmates"
            winReason="All tasks completed"
            role={PlayerRole.CREWMATE}
          />
        </GameProvider>
      );

      expect(screen.getByText('Victory!')).toBeInTheDocument();
      expect(screen.getByText('Crewmates Win!')).toBeInTheDocument();
      expect(screen.getByText('All tasks completed')).toBeInTheDocument();
    });

    it('should show game over screen for impostor win', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="ended"
            winner="impostors"
            winReason="Impostors equal crewmates"
            role={PlayerRole.CREWMATE}
          />
        </GameProvider>
      );

      expect(screen.getByText('Defeat')).toBeInTheDocument();
      expect(screen.getByText('Impostors Win!')).toBeInTheDocument();
    });

    it('should show play again button', async () => {
      const user = userEvent.setup();
      const onPlayAgain = jest.fn();
      
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="ended"
            winner="crewmates"
            onPlayAgain={onPlayAgain}
          />
        </GameProvider>
      );

      const playAgainButton = screen.getByRole('button', { name: /play again/i });
      await user.click(playAgainButton);

      expect(onPlayAgain).toHaveBeenCalled();
    });
  });

  describe('Player List', () => {
    const mockPlayers = [
      { id: 'p1', name: 'Player 1', alive: true, color: 'red', isHost: true },
      { id: 'p2', name: 'Player 2', alive: true, color: 'blue' },
      { id: 'test-player', name: 'Test Player', alive: true, color: 'yellow' }
    ];

    it('should display player list in lobby', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="lobby"
            players={mockPlayers}
          />
        </GameProvider>
      );

      expect(screen.getByText('Players (3/8)')).toBeInTheDocument();
      expect(screen.getByText('Player 1')).toBeInTheDocument();
      expect(screen.getByText('(Host)')).toBeInTheDocument();
    });

    it('should show start button for host with enough players', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            playerId="p1"
            gamePhase="lobby"
            players={[...mockPlayers, 
              { id: 'p4', name: 'Player 4', alive: true, color: 'green' },
              { id: 'p5', name: 'Player 5', alive: true, color: 'orange' }
            ]}
          />
        </GameProvider>
      );

      const startButton = screen.getByRole('button', { name: /start game/i });
      expect(startButton).toBeInTheDocument();
      expect(startButton).not.toBeDisabled();
    });

    it('should disable start button without enough players', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            playerId="p1"
            gamePhase="lobby"
            players={mockPlayers}
          />
        </GameProvider>
      );

      const startButton = screen.getByRole('button', { name: /start game/i });
      expect(startButton).toBeDisabled();
      expect(screen.getByText('Need at least 5 players')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should collapse sidebar on mobile', () => {
      // Mock mobile viewport
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }));

      render(
        <GameProvider>
          <GameUI {...defaultProps} />
        </GameProvider>
      );

      const sidebar = screen.getByTestId('game-sidebar');
      expect(sidebar).toHaveClass('hidden', 'md:block');
    });

    it('should show mobile menu button', async () => {
      const user = userEvent.setup();
      
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }));

      render(
        <GameProvider>
          <GameUI {...defaultProps} />
        </GameProvider>
      );

      const menuButton = screen.getByRole('button', { name: /menu/i });
      expect(menuButton).toBeInTheDocument();

      await user.click(menuButton);
      
      // Sidebar should become visible
      const sidebar = screen.getByTestId('game-sidebar');
      expect(sidebar).toHaveClass('block');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            role={PlayerRole.IMPOSTOR}
            canKill={true}
            nearbyPlayers={['p2']}
          />
        </GameProvider>
      );

      expect(screen.getByRole('button', { name: /kill player/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('region', { name: /game status/i })).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      
      render(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            gamePhase="voting"
            players={[
              { id: 'p1', name: 'Player 1', alive: true },
              { id: 'p2', name: 'Player 2', alive: true }
            ]}
          />
        </GameProvider>
      );

      // Tab through vote buttons
      await user.tab();
      expect(screen.getByRole('button', { name: /vote player 1/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /vote player 2/i })).toHaveFocus();
    });

    it('should announce important updates to screen readers', () => {
      const { rerender } = render(
        <GameProvider>
          <GameUI {...defaultProps} />
        </GameProvider>
      );

      rerender(
        <GameProvider>
          <GameUI 
            {...defaultProps}
            announcement="Body reported by Player 2!"
          />
        </GameProvider>
      );

      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent('Body reported by Player 2!');
      expect(announcement).toHaveAttribute('aria-live', 'assertive');
    });
  });
}); 
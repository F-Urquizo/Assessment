const mockSendMail = jest.fn().mockResolvedValue({});
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MailService } from './mail.service';

const LINK = 'http://localhost:5173/verify-email?token=abc123';

describe('MailService', () => {
  let service: MailService;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get(MailService);
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({});
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  describe('dev mode (no SMTP_HOST)', () => {
    beforeEach(() => configGet.mockReturnValue(undefined));

    it('logs the link to console instead of sending SMTP', async () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await service.sendVerificationEmail('user@example.com', LINK);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining(LINK));
      spy.mockRestore();
    });

    it('does not create an SMTP transporter', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});

      await service.sendVerificationEmail('user@example.com', LINK);

      expect(mockCreateTransport).not.toHaveBeenCalled();
    });
  });

  describe('prod mode (SMTP_HOST configured)', () => {
    beforeEach(() => {
      configGet.mockImplementation((key: string, fallback?: unknown) => {
        const cfg: Record<string, unknown> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: '587',
          SMTP_USER: 'user@example.com',
          SMTP_PASS: 'secret',
          SMTP_FROM: 'noreply@example.com',
        };
        return cfg[key] ?? fallback;
      });
    });

    it('creates a transporter with the configured SMTP host', async () => {
      await service.sendVerificationEmail('to@example.com', LINK);

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com' }),
      );
    });

    it('calls sendMail with the recipient address and a body containing the link', async () => {
      await service.sendVerificationEmail('to@example.com', LINK);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          html: expect.stringContaining(LINK),
        }),
      );
    });
  });
});

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { AuthRegisterDto } from './dto/auth-register.dto';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailer: MailerService,
  ) {}

  async createToken(user: User) {
    return {
      accessToken: this.jwtService.sign(
        {
          name: user.name,
          email: user.email,
        },
        {
          expiresIn: '3 days',
          subject: String(user.id),
          issuer: 'login',
          audience: 'users',
        },
      ),
    };
  }

  checkToken(token: string) {
    try {
      const data = this.jwtService.verify(token, {
        audience: 'users',
        issuer: 'login',
      });
      return data;
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  isValidToken(token: string) {
    if (this.checkToken(token)) {
      return true;
    } else {
      return false;
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) throw new UnauthorizedException('Email e/ou senhas incorretos!');

    if (!(await bcrypt.compare(password, user.password)))
      throw new UnauthorizedException('Email e/ou senhas incorretos!');

    return this.createToken(user);
  }

  async forget(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!user) throw new UnauthorizedException('Email inválido!');

    const token = this.jwtService.sign(
      { id: user.id },
      {
        expiresIn: '30 minutes',
        subject: String(user.id),
        issuer: 'forget',
        audience: 'users',
      },
    );

    await this.mailer.sendMail({
      subject: 'Recuperação de senha',
      to: 'willianbr.ac68@gmail.com',
      template: 'forget',
      context: {
        name: user.name,
        token,
      },
    });
    return true;
  }

  async reset(password: string, jwt: string) {
    try {
      const data = this.jwtService.verify(jwt, {
        issuer: 'forget',
        audience: 'users',
      });

      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await this.prisma.user.update({
        where: { id: data.id },
        data: { password: hashedPassword },
      });

      return this.createToken(user);
    } catch (err) {
      throw new BadRequestException('Token inválido!');
    }
  }

  async register(data: AuthRegisterDto) {
    const user = await this.usersService.create(data);
    return this.createToken(user);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { UpdatePutUserDto } from './dto/update-put-user.dto';
import { UpdatePatchUserDto } from './dto/update-patch-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create({ name, email, password, role }: CreateUserDto) {
    const user = await this.findOneByEmail(email);
    if (user) throw new BadRequestException('User alread exists!');
    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt());
    return await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });
  }

  async findAll() {
    return await this.prisma.user.findMany({
      where: {
        email: {
          contains: '@gmail.com',
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found!');
    }
    return user;
  }

  private async findOneByEmail(email: string) {
    return await this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, data: UpdatePutUserDto) {
    await this.exists(id);
    const hashedPassword = await bcrypt.hash(
      data.password,
      await bcrypt.genSalt(),
    );
    await this.prisma.user.update({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
      where: { id },
    });
  }

  async updatePartial(id: string, data: UpdatePatchUserDto) {
    await this.exists(id);

    if (data.password) {
      data.password = await bcrypt.hash(data.password, await bcrypt.genSalt());
    }
    await this.prisma.user.update({
      data,
      where: { id },
    });
  }

  async remove(id: string) {
    await this.exists(id);
    await this.prisma.user.delete({ where: { id } });
  }

  async exists(id: string) {
    if (!(await this.prisma.user.count({ where: { id } }))) {
      throw new NotFoundException('User not found!');
    }
  }
}

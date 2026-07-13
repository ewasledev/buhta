import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { XuiApiError, XuiAuthError, XuiConnectionError } from '../../xui/xui.errors';

@Catch(XuiApiError, XuiConnectionError, XuiAuthError)
export class XuiExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof XuiConnectionError) {
      res.status(504).json({ message: 'Панель недоступна' });
    } else if (exception instanceof XuiAuthError) {
      res
        .status(502)
        .json({ message: 'Ошибка авторизации в панели — проверьте XUI_USERNAME/XUI_PASSWORD' });
    } else {
      res.status(502).json({ message: exception.message });
    }
  }
}

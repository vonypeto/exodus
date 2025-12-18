import { ObjectId } from '@exodus/object-id';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ObjectIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        function transform(obj: any): any {
          if (Array.isArray(obj)) {
            return obj.map(transform);
          }
          if (obj && typeof obj === 'object') {
            const newObj: any = {};
            for (const key of Object.keys(obj)) {
              if (key === 'id' && obj[key]) {
                try {
                  newObj[key] = ObjectId.from(obj[key]).toString();
                } catch {
                  newObj[key] = obj[key];
                }
              } else {
                newObj[key] = transform(obj[key]);
              }
            }
            return newObj;
          }
          return obj;
        }
        return transform(data);
      })
    );
  }
}

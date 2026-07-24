import echo from './echo'

class RealtimeService {
  subscribeToDtrProgress(
    userId: number,
    callback: (payload: any) => void,
    onError?: (error: any) => void,
  ) {
    return echo
      .private(`dtr-progress.${userId}`)
      .subscribed(() => console.log(`[Reverb] subscribed to dtr-progress.${userId}`))
      .listen('.progress.updated', callback)
      .error((error: any) => onError?.(error))
  }

  leaveDtrProgress(userId: number) {
    echo.leave(`dtr-progress.${userId}`)
  }
}

export default new RealtimeService()

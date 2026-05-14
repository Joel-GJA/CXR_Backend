using UnityEngine;

namespace CXR.SDK.Utils
{
    public static class CXRLogger
    {
        private const string Prefix = "[CXR SDK] ";

        public static bool VerboseLogging { get; set; }

        public static void Info(string message)
        {
            if (!VerboseLogging)
            {
                return;
            }

            Debug.Log(Prefix + message);
        }

        public static void Warn(string message)
        {
            Debug.LogWarning(Prefix + message);
        }

        public static void Error(string message)
        {
            Debug.LogError(Prefix + message);
        }
    }
}

#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class BuildCommands
{
    public static void BuildLinuxServer(string locationPath = "Builds/LinuxServer/CXR_Server.x86_64")
    {
        BuildPlayerOptions options = new BuildPlayerOptions
        {
            scenes = new[]
            {
                "Assets/Multiplayer/Scenes/LobbyScene.unity",
                "Assets/Multiplayer/Scenes/SessionScene.unity",
                "Assets/Multiplayer/Scenes/XRPresenceTestScene.unity"
            },
            locationPathName = locationPath,
            target = BuildTarget.StandaloneLinux64,
            subtarget = (int)StandaloneBuildSubtarget.Server,
            options = BuildOptions.NoUniqueIdentifier
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);
        if (report.summary.result == BuildResult.Succeeded)
            Debug.Log($"[BUILD] Server build succeeded: {report.summary.totalSize} bytes at {locationPath}");
        else
            throw new BuildFailedException(report.summary.ToString());
    }

    public static void BuildWindowsClient(string locationPath = "Builds/WindowsClient/CXR_Client")
    {
        BuildPlayerOptions options = new BuildPlayerOptions
        {
            scenes = new[]
            {
                "Assets/Multiplayer/Scenes/LobbyScene.unity",
                "Assets/Multiplayer/Scenes/SessionScene.unity",
                "Assets/Multiplayer/Scenes/XRPresenceTestScene.unity"
            },
            locationPathName = locationPath,
            target = BuildTarget.StandaloneWindows64,
            subtarget = (int)StandaloneBuildSubtarget.Player,
            options = BuildOptions.None
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);
        if (report.summary.result == BuildResult.Succeeded)
            Debug.Log($"[BUILD] Windows client build succeeded: {report.summary.totalSize} bytes");
        else
            throw new BuildFailedException(report.summary.ToString());
    }

    public static void BuildAndroidClient(string locationPath = "Builds/AndroidClient/CXR_Client.apk")
    {
        BuildPlayerOptions options = new BuildPlayerOptions
        {
            scenes = new[]
            {
                "Assets/Multiplayer/Scenes/LobbyScene.unity",
                "Assets/Multiplayer/Scenes/SessionScene.unity",
                "Assets/Multiplayer/Scenes/XRPresenceTestScene.unity"
            },
            locationPathName = locationPath,
            target = BuildTarget.Android,
            subtarget = (int)StandaloneBuildSubtarget.Player,
            options = BuildOptions.None
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);
        if (report.summary.result == BuildResult.Succeeded)
            Debug.Log($"[BUILD] Android client build succeeded: {report.summary.totalSize} bytes");
        else
            throw new BuildFailedException(report.summary.ToString());
    }
}
#endif

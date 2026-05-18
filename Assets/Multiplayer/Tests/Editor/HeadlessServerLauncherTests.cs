using NUnit.Framework;
using CXR.SDK.Discovery;
using UnityEngine;

public sealed class HeadlessServerLauncherTests
{
    [Test]
    public void ParseCommandLine_ReadsServerConfiguration()
    {
        HeadlessServerConfig config =
            HeadlessServerLauncher.ParseCommandLine(
                new[]
                {
                    "App.exe",
                    "-batchmode",
                    "-cxrHeadlessServer",
                    "-roomName",
                    "Training Room",
                    "-maxParticipants",
                    "12",
                    "-port",
                    "7788",
                    "-metadata",
                    "scenario=airway",
                    "-metadata",
                    "cohort=interns"
                });

        Assert.IsTrue(config.StartServer);
        Assert.AreEqual("Training Room", config.RoomName);
        Assert.AreEqual(12, config.MaxParticipants);
        Assert.AreEqual(7788, config.Port);
        Assert.AreEqual("airway", config.Metadata["scenario"]);
        Assert.AreEqual("interns", config.Metadata["cohort"]);
    }

    [Test]
    public void ParseCommandLine_ReadsLinuxStyleArguments()
    {
        HeadlessServerConfig config =
            HeadlessServerLauncher.ParseCommandLine(
                new[]
                {
                    "./CXR_Backend.x86_64",
                    "-batchmode",
                    "-nographics",
                    "--cxr-headless-server",
                    "--room-name=Ubuntu CLI Room",
                    "--max-participants=10",
                    "--port=7790",
                    "--registry-url=http://127.0.0.1:8080",
                    "--public-address=203.0.113.10",
                    "--metadata=scenario=icu",
                    "--metadata",
                    "region=lab"
                });

        Assert.IsTrue(config.StartServer);
        Assert.AreEqual("Ubuntu CLI Room", config.RoomName);
        Assert.AreEqual(10, config.MaxParticipants);
        Assert.AreEqual(7790, config.Port);
        Assert.AreEqual("http://127.0.0.1:8080", config.RegistryUrl);
        Assert.AreEqual("203.0.113.10", config.PublicAddress);
        Assert.AreEqual("icu", config.Metadata["scenario"]);
        Assert.AreEqual("lab", config.Metadata["region"]);
    }

    [Test]
    public void ApplyConfiguration_UpdatesDiscoveryAdvertisement()
    {
        GameObject root = new GameObject("Headless Server Launcher Test");

        try
        {
            DiscoveryBroadcaster broadcaster =
                root.AddComponent<DiscoveryBroadcaster>();
            root.AddComponent<RuntimeSessionManager>();
            RuntimeSessionSdkBridge bridge =
                root.AddComponent<RuntimeSessionSdkBridge>();
            HeadlessServerLauncher launcher =
                root.AddComponent<HeadlessServerLauncher>();

            HeadlessServerConfig config = new HeadlessServerConfig
            {
                RoomName = "Dedicated Validation",
                MaxParticipants = 6,
                Port = 7799
            };

            config.SetMetadata("scenario", "validation");

            launcher.ApplyConfiguration(config);
            bridge.PublishSessionAdvertisement();

            broadcaster.RequireServerActive = false;

            Assert.IsTrue(broadcaster.TryBuildResponse(out var response));
            Assert.AreEqual("Dedicated Validation", response.RoomName);
            Assert.AreEqual(6, response.MaxPlayers);
            Assert.AreEqual(7799, response.Port);

            AssertMetadata(response, "serverMode", "Dedicated");
            AssertMetadata(response, "scenario", "validation");
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }

    private static void AssertMetadata(
        CXRDiscoveryResponse response,
        string key,
        string expectedValue)
    {
        foreach (var entry in response.Metadata)
        {
            if (entry.Key == key)
            {
                Assert.AreEqual(expectedValue, entry.Value);
                return;
            }
        }

        Assert.Fail("Missing metadata entry: " + key);
    }
}

{ pkgs }: {
  # Nixpkgs channel to use
  channel = "stable-24.11";

  # Add required packages here
  packages = [
    pkgs.nodejs_20
    pkgs.python3
    pkgs.python3Packages.pip
  ];

  # Set any environment variables if needed
  env = {};

  idx = {
    # Add editor extensions (if needed) from https://open-vsx.org
    extensions = [
      # Example: "ms-python.python"
    ];

    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };

    # Enable preview functionality
    previews = {
      enable = true;
      previews = {
        web = {
          command = [
            "npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"
          ];
          manager = "web";
        };
      };
    };
  };
}